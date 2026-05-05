import { Component, inject, signal, WritableSignal } from "@angular/core";
import { JWK, SignJWT } from "jose";
import { FormsModule } from "@angular/forms";
import { EMPTY, from, of, switchMap, tap, catchError } from "rxjs";
import { ValidationPanelComponent } from "@components/validation-panel/validation-panel.component";
import { ValidationItemComponent } from "@components/validation-item/validation-item.component";
import { MatList } from "@angular/material/list";
import { MatAccordion } from "@angular/material/expansion";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { DeeplinkInput } from "../../components/deeplink-input/deeplink-input.component";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";
import { VerificationService } from "@services/verification.service";
import { HolderKeyService } from "@services/holder-key.service";
import { SdJwtStoreService } from "@services/sd-jwt-store.service";
import { VcKeyStoreService } from "@services/vc-key-store.service";
import { VcStoreService } from "@services/vc-store.service";
import { Router } from "@angular/router";
import { DcqlClaimDto, DcqlCredentialDto, DcqlQueryDto, RequestObject } from "src/generated/verifier";
import { JwtPayload } from "@app/models/api-response";
import { DataViewerComponent } from "@app/components/data-viewer/data-viewer.component";
import { OIDVPService } from "@services/oidvp-service";
import { CryptoService } from "@services/crypto-service";
import { ErrorFormatterService } from "@services/error-formatter-service";

type PayloadEncryptionStatus = {
  responseMode: string | undefined;
  required: boolean;
  jwks: unknown;
  encValuesSupported: string[] | undefined;
};

@Component({
  selector: "app-credential-verification",
  imports: [
    ValidationPanelComponent,
    ValidationItemComponent,
    MatList,
    MatAccordion,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    DeeplinkInput,
    MatCard,
    MatCardTitle,
    MatCardContent,
    DataViewerComponent,
  ],
  templateUrl: "./credential-verification.html",
  standalone: true,
})
export class CredentialVerification {
  private oidvpService = inject(OIDVPService);
  private verificationService = inject(VerificationService);
  private holderKeyService = inject(HolderKeyService);
  private sdJwtStore = inject(SdJwtStoreService);
  private vcKeyStore = inject(VcKeyStoreService);
  private vcStore = inject(VcStoreService);
  private router = inject(Router);
  private cryptoService = inject(CryptoService);
  private errorFormatter = inject(ErrorFormatterService);

  sdJwt = this.sdJwtStore.getVerificationSdJwt();

  readonly panelOpenState = signal(false);
  public input =
    "swiyu-verify://?client_id=did%3Atdw%3AQmcsWxATnPMAcbjukjXAkVAUAKRSC71mjMWjod4NVWrZ9Y%3Amockserver%253A1080%3Aapi%3Av2%3Adid%3A64f74058-4fa3-4609-a7b4-dd6a8853bc32&request_uri=http%3A%2F%2Fdefault-verifier-url.admin.ch%2Foid4vp%2Fapi%2Frequest-object%2F9eafca2d-9bae-46a2-a81d-f3576809d2c0";

  credentialInput: WritableSignal<string> = signal("");
  credential: WritableSignal<string | undefined> = signal(undefined);
  credentialError = signal<Record<string, any> | string | undefined>(undefined);

  decodedHeader: WritableSignal<JwtPayload | undefined> = signal(undefined);
  decodedPayload: WritableSignal<JwtPayload | undefined> = signal(undefined);

  deeplink: WritableSignal<Record<string, string> | undefined> = signal(undefined);
  deeplinkError = signal<Record<string, any> | string | undefined>(undefined);

  requestObjectResponse: WritableSignal<RequestObject | string | undefined> = signal(undefined);
  requestObject: WritableSignal<RequestObject | undefined> = signal(undefined);
  requestObjectError = signal<Record<string, any> | string | undefined>(undefined);

  dcqlQuery: WritableSignal<DcqlQueryDto | undefined> = signal(undefined);
  dcqlQueryError = signal<Record<string, any> | string | undefined>(undefined);

  requiredCredentials: WritableSignal<DcqlCredentialDto[] | undefined> = signal(undefined);
  requiredCredentialsError = signal<Record<string, any> | string | undefined>(undefined);

  payloadEncryption: WritableSignal<PayloadEncryptionStatus | undefined> = signal(undefined);
  payloadEncryptionError = signal<Record<string, any> | string | undefined>(undefined);

  vpToken: WritableSignal<string | undefined> = signal(undefined);
  vpTokenError = signal<Record<string, any> | string | undefined>(undefined);

  verificationResponse: WritableSignal<string | undefined> = signal(undefined);
  verificationResponseSubmitted: WritableSignal<boolean | undefined> = signal(undefined);
  verificationResponseError = signal<Record<string, any> | string | undefined>(undefined);

  constructor() {
    const navigation = this.router.getCurrentNavigation();
    const credential = navigation?.extras?.state?.["credential"] as string | undefined;
    if (credential) {
      this.credentialInput.set(credential);
    }
  }

  public onClear(): void {
    this.reset();
  }

  public onResolve(input: string): void {
    this.reset();

    from([this.credentialInput()])
      .pipe(
        tap((credential: string) => {
          this.validateCredential(credential);
          this.credential.set(credential);
        }),
        catchError((error) => {
          this.credentialError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => of(input)),
        tap((deeplinkInput: string) => {
          const deeplink = this.verificationService.decodeDeeplink(deeplinkInput);
          this.deeplink.set(deeplink);
        }),
        catchError((error) => {
          this.deeplinkError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => {
          const requestObjectUrl = this.deeplink()?.["request_uri"];
          if (!requestObjectUrl) {
            throw new Error("Missing request_uri");
          }

          return this.oidvpService.fetchRequestObject(requestObjectUrl);
        }),
        tap((requestObjectResponse: RequestObject | string) => {
          this.requestObjectResponse.set(requestObjectResponse);
          this.requestObject.set(this.cryptoService.decodeIfJwt<RequestObject>(requestObjectResponse));
        }),
        catchError((error) => {
          this.requestObjectError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => of(this.requestObject()?.dcql_query)),
        tap((dcqlQuery: DcqlQueryDto | undefined) => {
          if (!dcqlQuery) {
            throw new Error("Missing DCQL query");
          }

          this.dcqlQuery.set(dcqlQuery);
        }),
        catchError((error) => {
          this.dcqlQueryError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => of(this.verificationService.extractCredentialsFromDCQL(this.dcqlQuery()!))),
        tap((requiredCredentials: DcqlCredentialDto[]) => {
          if (requiredCredentials.length === 0) {
            throw new Error("DCQL query does not request any credentials");
          }

          this.requiredCredentials.set(requiredCredentials);
        }),
        catchError((error) => {
          this.requiredCredentialsError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => of(this.extractPayloadEncryptionStatus(this.requestObject()!))),
        tap((payloadEncryption: PayloadEncryptionStatus) => {
          this.payloadEncryption.set(payloadEncryption);
        }),
        catchError((error) => {
          this.payloadEncryptionError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() =>
          from(
            this.createAndSignPresentation(
              this.credential()!,
              this.requestObject()?.client_id as string,
              this.requestObject()?.nonce as string
            )
          )
        ),
        tap((vpToken: string) => {
          this.vpToken.set(vpToken);
        }),
        catchError((error) => {
          this.vpTokenError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => {
          const dcqlCredentials = this.dcqlQuery()?.credentials ?? [];
          const credentialId = dcqlCredentials[0]?.id || "credential_1";

          return this.oidvpService.submitVerificationResponse(
            this.requestObject()!,
            this.vpToken()!,
            credentialId
          );
        }),
        tap((response: string) => {
          this.verificationResponse.set(response);
          this.verificationResponseSubmitted.set(true);
        }),
        catchError((error) => {
          this.verificationResponseSubmitted.set(false);
          this.verificationResponseError.set(this.errorFormatter.formatRequestError(error, "POST"));
          return EMPTY;
        })
      )
      .subscribe();
  }

  public reset(): void {
    this.credential.set(undefined);
    this.credentialError.set(undefined);
    this.decodedHeader.set(undefined);
    this.decodedPayload.set(undefined);
    this.deeplink.set(undefined);
    this.deeplinkError.set(undefined);
    this.requestObjectResponse.set(undefined);
    this.requestObject.set(undefined);
    this.requestObjectError.set(undefined);
    this.dcqlQuery.set(undefined);
    this.dcqlQueryError.set(undefined);
    this.requiredCredentials.set(undefined);
    this.requiredCredentialsError.set(undefined);
    this.payloadEncryption.set(undefined);
    this.payloadEncryptionError.set(undefined);
    this.vpToken.set(undefined);
    this.vpTokenError.set(undefined);
    this.verificationResponse.set(undefined);
    this.verificationResponseSubmitted.set(undefined);
    this.verificationResponseError.set(undefined);
  }

  public extractClaimsFromDcqlQuery(dcqlQuery: DcqlQueryDto | undefined): DcqlClaimDto[] {
    if (!dcqlQuery?.credentials) {
      return [];
    }

    const extractedClaims: DcqlClaimDto[] = [];
    const seenPaths = new Set<string>();

    dcqlQuery.credentials.forEach((credential: DcqlCredentialDto) => {
      const claims = credential.claims ?? [];

      claims.forEach((claim: DcqlClaimDto) => {
        if (!Array.isArray(claim.path)) {
          return;
        }

        const pathKey = claim.path.join("|");

        if (!seenPaths.has(pathKey)) {
          seenPaths.add(pathKey);
          extractedClaims.push(claim);
        }
      });
    });

    return extractedClaims;
  }

  private validateCredential(credentialString: string): void {
    if (!credentialString?.trim()) {
      throw new Error("No credential provided");
    }

    if (!credentialString.includes("~")) {
      throw new Error("Invalid SD-JWT format: missing tilde separator");
    }

    const jwtPart = credentialString.split("~")[0];
    const jwtComponents = jwtPart.split(".");

    if (jwtComponents.length !== 3) {
      throw new Error("Invalid JWT format: expected 3 components");
    }

    const headerJson = JSON.parse(new TextDecoder().decode(this.base64UrlDecode(jwtComponents[0])));
    const payloadJson = JSON.parse(new TextDecoder().decode(this.base64UrlDecode(jwtComponents[1])));

    this.decodedHeader.set(headerJson);
    this.decodedPayload.set(payloadJson);
  }

  private extractPayloadEncryptionStatus(requestObject: RequestObject): PayloadEncryptionStatus {
    const required = requestObject.response_mode === "direct_post.jwt";

    if (required && !requestObject.client_metadata?.jwks?.keys?.length) {
      throw new Error("Payload encryption is required but verifier encryption JWKs are missing");
    }

    if (required && !requestObject.client_metadata?.encrypted_response_enc_values_supported?.length) {
      throw new Error("Payload encryption is required but supported encryption methods are missing");
    }

    return {
      responseMode: requestObject.response_mode,
      required,
      jwks: requestObject.client_metadata?.jwks,
      encValuesSupported: requestObject.client_metadata?.encrypted_response_enc_values_supported,
    };
  }

  private base64UrlDecode(input: string): Uint8Array {
    const padded = input + "==".substring(0, (4 - input.length % 4) % 4);
    const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private async createAndSignPresentation(
    credentialString: string,
    verifierId: string,
    nonce: string
  ): Promise<string> {
    if (!verifierId) {
      throw new Error("Missing verifier client_id");
    }

    if (!nonce) {
      throw new Error("Missing nonce");
    }

    const requiredFields = this.extractClaimsFromDcqlQuery(this.dcqlQuery());
    const payloadJson = this.extractPayloadFromSdJwt(credentialString);
    const validationErrors = this.validateRequiredFields(requiredFields, payloadJson, credentialString);

    if (validationErrors.length > 0) {
      throw new Error(`Missing required fields: ${validationErrors.join(", ")}`);
    }

    const selectiveDisclosureSdJwt = await this.createSelectiveDisclosureSdJwt(credentialString, requiredFields);
    const sdHash = await this.calculateSdHash(selectiveDisclosureSdJwt);
    const holderKeyPair = this.findCredentialKeyPair(credentialString);

    const kbJwt = await new SignJWT({
      sd_hash: sdHash,
      nonce,
    })
      .setProtectedHeader({
        alg: "ES256",
        typ: "kb+jwt",
        jwk: holderKeyPair.jwk,
      })
      .setAudience(verifierId)
      .setIssuedAt(new Date())
      .sign(holderKeyPair.privateKey);

    return `${selectiveDisclosureSdJwt}${kbJwt}`;
  }

  private findCredentialKeyPair(credentialString: string): { privateKey: CryptoKey; jwk: JWK } {
    const storedVCs = this.vcStore.getAllVcs();

    for (const vc of storedVCs) {
      if (vc.credential !== credentialString) {
        continue;
      }

      const keyPair = this.vcKeyStore.getKeyPairByVcId(vc.vcId);
      if (keyPair) {
        return keyPair;
      }
    }

    return {
      privateKey: this.holderKeyService.getPrivateKey(),
      jwk: this.holderKeyService.getJwk(),
    };
  }

  private async calculateSdHash(sdJwtPresentation: string): Promise<string> {
    const data = new TextEncoder().encode(sdJwtPresentation);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashBytes = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode.apply(null, hashBytes));

    return hashBase64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  private async createSelectiveDisclosureSdJwt(
    fullSdJwt: string,
    requiredFields: DcqlClaimDto[]
  ): Promise<string> {
    const disclosureExcluded = new Set(["iss", "nbf", "exp", "cnf", "status"]);
    const requiredClaimNames = this.extractRequiredClaimNames(requiredFields);
    const parts = fullSdJwt.split("~");
    const jwtPart = parts[0];
    const disclosureParts = parts.slice(1, -1);
    const selectedDisclosures: string[] = [];

    disclosureParts.forEach((disclosure: string) => {
      if (!disclosure) {
        return;
      }

      const decodedDisclosure = this.decodeDisclosure(disclosure);
      const claimName = decodedDisclosure?.[1];

      if (typeof claimName !== "string" || disclosureExcluded.has(claimName)) {
        return;
      }

      if (requiredClaimNames.has(claimName)) {
        selectedDisclosures.push(disclosure);
      }
    });

    if (selectedDisclosures.length === 0) {
      return `${jwtPart}~`;
    }

    return `${jwtPart}~${selectedDisclosures.join("~")}~`;
  }

  private extractPayloadFromSdJwt(sdJwt: string): Record<string, unknown> {
    const jwtPart = sdJwt.split("~")[0];
    const [, payloadB64] = jwtPart.split(".");
    return JSON.parse(new TextDecoder().decode(this.base64UrlDecode(payloadB64))) as Record<string, unknown>;
  }

  private validateRequiredFields(
    requiredFields: DcqlClaimDto[],
    payloadJson: Record<string, unknown>,
    sdJwt: string
  ): string[] {
    const requiredClaimNames = this.extractRequiredClaimNames(requiredFields);
    const disclosedClaimNames = this.extractDisclosureClaimNames(sdJwt);

    return Array.from(requiredClaimNames).filter((claimName) => {
      return !(claimName in payloadJson) && !disclosedClaimNames.has(claimName);
    });
  }

  private extractRequiredClaimNames(requiredFields: DcqlClaimDto[]): Set<string> {
    const reservedClaims = new Set(["iss", "nbf", "exp", "cnf", "vct", "status"]);
    const claimNames = requiredFields
      .flatMap((claim) => (Array.isArray(claim.path) ? claim.path : []))
      .filter((claimName): claimName is string => typeof claimName === "string")
      .filter((claimName) => !reservedClaims.has(claimName));

    return new Set(claimNames);
  }

  private extractDisclosureClaimNames(sdJwt: string): Set<string> {
    const disclosures = sdJwt.split("~").slice(1, -1);
    const claimNames = disclosures
      .map((disclosure) => this.decodeDisclosure(disclosure)?.[1])
      .filter((claimName): claimName is string => typeof claimName === "string");

    return new Set(claimNames);
  }

  private decodeDisclosure(disclosure: string): unknown[] | undefined {
    try {
      const decoded = JSON.parse(new TextDecoder().decode(this.base64UrlDecode(disclosure)));
      return Array.isArray(decoded) ? decoded : undefined;
    } catch {
      return undefined;
    }
  }
}
