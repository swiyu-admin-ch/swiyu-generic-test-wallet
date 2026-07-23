import {
  Component,
  inject,
  OnInit,
  signal,
  WritableSignal,
} from "@angular/core";
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
import { TrustStatementVerifierService } from "@app/services/trust-statement-verifier.service";
import { environment } from "src/environments/environment";
import {
  DcqlClaimDto,
  DcqlCredentialDto,
  DcqlQueryDto,
  RequestObject,
} from "src/generated/verifier";
import { JwtPayload, RegistryEntry } from "@app/models/api-response";
import { DataViewerComponent } from "@app/components/data-viewer/data-viewer.component";
import { OIDVPService } from "@services/oidvp-service";
import { CryptoService } from "@services/crypto-service";
import { ErrorFormatterService } from "@services/error-formatter-service";
import {
  TrustMarkers,
  TrustStatement,
  TrustVerificationResult,
} from "@app/models/trust-statement-verifier.model";
import { TrustService } from "@app/services/trust-service";
import { WalletService } from "@app/services/wallet-service";
import { OIDVCIService } from "@app/services/oidvci-service";
import { DidResponse } from "@app/models/did-response";
import { RegistryService } from "@app/services/registryService";

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
export class CredentialVerification implements OnInit {
  private oidvciService = inject(OIDVCIService);
  private oidvpService = inject(OIDVPService);
  private verificationService = inject(VerificationService);
  private registryService = inject(RegistryService);
  private holderKeyService = inject(HolderKeyService);
  private sdJwtStore = inject(SdJwtStoreService);
  private vcKeyStore = inject(VcKeyStoreService);
  private vcStore = inject(VcStoreService);
  private cryptoService = inject(CryptoService);
  private errorFormatter = inject(ErrorFormatterService);
  private trustService = inject(TrustService);
  private trustStatementVerifierService = inject(TrustStatementVerifierService);
  sdJwt = this.sdJwtStore.getVerificationSdJwt();
  private walletService = inject(WalletService);

  readonly panelOpenState = signal(false);

  credential: WritableSignal<
    | {
        sdjwt?: string;
        error?: Record<string, any> | string;
        decodedHeader?: JwtPayload;
        decodedPayload?: JwtPayload;
      }
    | undefined
  > = signal(undefined);

  credentialInput: WritableSignal<string> = signal("");
  deeplink: WritableSignal<
    | {
        decoded?: any;
        requestUri?: string;
        error?: Record<string, any> | string;
      }
    | undefined
  > = signal(undefined);

  requestObject: WritableSignal<
    | {
        parsed?: RequestObject;
        response?: RequestObject | string;
        error?: Record<string, any> | string;
      }
    | undefined
  > = signal(undefined);

  dcql: WritableSignal<
    | {
        response?: DcqlQueryDto | string;
        query?: DcqlQueryDto | undefined;
        error?: Record<string, any> | string;
      }
    | undefined
  > = signal(undefined);

  requiredCredentials: WritableSignal<DcqlCredentialDto[] | undefined> =
    signal(undefined);
  requiredCredentialsError = signal<Record<string, any> | string | undefined>(
    undefined,
  );

  payloadEncryption: WritableSignal<PayloadEncryptionStatus | undefined> =
    signal(undefined);
  payloadEncryptionError = signal<Record<string, any> | string | undefined>(
    undefined,
  );

  token: WritableSignal<
    { token?: string; error?: Record<string, any> | string } | undefined
  > = signal(undefined);

  verification: WritableSignal<
    | {
        response?: string;
        submitted?: boolean;
        error?: Record<string, any> | string;
      }
    | undefined
  > = signal(undefined);

  registry: WritableSignal<
    | {
        registry?: RegistryEntry | RegistryEntry[];
        registryEntryError?: Record<string, any> | string;
      }
    | undefined
  > = signal(undefined);

  trustStatements: WritableSignal<
    | {
        idTS?: string;
        idTSDecoded?: TrustStatement | undefined;
        pvaTS?: string | undefined;
        pvaTSDecoded?: TrustStatement | undefined;
        ncTLS?: string;
        ncTLSDecoded?: TrustStatement;
        vqPS?: string;
        vqPSDecoded?: TrustStatement;
        markers?: TrustMarkers;
      }
    | undefined
  > = signal(undefined);

  ngOnInit(): void {
    const requestedVCs = this.walletService.getRequestedVCs()();
    const initInput = requestedVCs.at(0)?.sdJwt ?? "";
    this.credentialInput.set(initInput);
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
          this.credential.update((current) => ({
            ...current,
            sdjwt: credential,
          }));
        }),
        catchError((error) => {
          this.credential.update((current) => ({
            ...current,
            error: this.errorFormatter.format(error),
          }));
          return EMPTY;
        }),
        tap(() =>
          this.deeplink.update((current) => ({
            ...current,
            decoded: this.verificationService.decodeDeeplink(input),
            requestUri:
              this.verificationService.decodeDeeplink(input)["request_uri"],
          })),
        ),
        catchError((error) => {
          this.deeplink.update((current) => ({
            ...current,
            error: this.errorFormatter.format(error),
          }));
          return EMPTY;
        }),
        switchMap(() => {
          if (!this.deeplink()?.requestUri) {
            throw new Error("Missing request_uri");
          }

          return this.oidvpService.fetchRequestObject(
            this.deeplink()?.requestUri!,
          );
        }),
        tap((requestObjectResponse: RequestObject | string) => {
          this.requestObject.update((current) => ({
            ...current,
            response: requestObjectResponse,
            parsed: this.cryptoService.decodeIfJwt<RequestObject>(
              requestObjectResponse,
            ),
          }));
          this.trustStatements.update((current) => ({
            ...current,
            idTS: this.requestObject()?.parsed?.verifier_info?.at(0)?.data,
            idTSDecoded: this.cryptoService.decodeIfJwt<TrustStatement>(
              this.requestObject()?.parsed?.verifier_info?.at(0)
                ?.data as string,
            ),
          }));
        }),
        catchError((error) => {
          this.requestObject.update((current) => ({
            ...current,
            error: this.errorFormatter.format(error),
          }));
          return EMPTY;
        }),
        tap(() => {
          const dcqlQuery = this.getDCQLQueryFromRequestObject();

          console.log("dcqlQuery", dcqlQuery);
          this.dcql.update((current) => ({ ...current, query: dcqlQuery }));
        }),
        catchError((error) => {
          this.dcql.update((current) => ({
            ...current,
            error: this.errorFormatter.format(error),
          }));
          return EMPTY;
        }),
        switchMap(() =>
          of(
            this.verificationService.extractCredentialsFromDCQL(
              this.dcql()?.query!,
            ),
          ),
        ),
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
        switchMap(() => {
          this.payloadEncryption.set(
            this.extractPayloadEncryptionStatus(this.requestObject()?.parsed!),
          );
          return of(null);
        }),
        catchError((error) => {
          this.payloadEncryptionError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() =>
          this.trustService.getVerificationTrustStatements(
            this.requestObject()?.parsed?.client_id as string,
          ),
        ),
        tap((response) => {
          console.log("Trust statements response", response);
          this.trustStatements.update((current) => ({
            ...current,
            ncTLS: response.ncTLS,
            ncTLSDecoded: this.cryptoService.decodeIfJwt<TrustStatement>(
              response.ncTLS,
            ),
            pvaTS: response.pvaTS,
            pvaTSDecoded: this.cryptoService.decodeIfJwt<TrustStatement>(
              response.pvaTS,
            ),
          }));
        }),
        switchMap(() => {
          const did = this.requestObject()?.parsed?.iss! as string;
          const parts = did.split(":");
          const registryEntry = `https://${decodeURIComponent(did.substring(did.indexOf(parts[3]), did.length).replace(/:/g, "/"))}/did.jsonl`;
          return this.oidvciService.fetchRegistryEntry(registryEntry);
        }),
        tap((entry: RegistryEntry[]) => {
          this.registry.update((current) => ({
            ...current,
            registryEntry: entry,
          }));
        }),
        catchError((error) => {
          this.registry.update((current) => ({
            ...current,
            registryEntryError: this.errorFormatter.format(error),
          }));
          return EMPTY;
        }),
        switchMap((entry: RegistryEntry[] | DidResponse) => {
          return this.registryService.getCryptoKeysFromRegistryEntry(entry);
        }),
        switchMap((cryptoKeys: CryptoKey[]) => {
          const statements = [
            this.trustStatements()?.idTS!,
            this.trustStatements()?.ncTLS?.length
              ? this.trustStatements()?.ncTLS!
              : "",
            this.trustStatements()?.pvaTS?.length
              ? this.trustStatements()?.pvaTS!
              : "",
          ];

          this.trustStatementVerifierService.initialize(statements, {
            allowedHosts: environment.allowedHosts,
          });

          return from(
            this.trustStatementVerifierService.verifyVerifierStatements(
              environment.trustRoot,
              this.trustStatements()?.pvaTSDecoded?.iss!,
              this.requestObject()?.parsed?.iss?.toString() ?? "",
              cryptoKeys,
              // this is a mock at the moment as it isn't checked at the moment
              [
                {
                  sub: "test",
                  statusList: {
                    statusListData: "Test",
                    bits: 1,
                  },
                },
              ],
            ),
          );
        }),
        tap((verificationResult: TrustVerificationResult) => {
          this.trustStatements.update((current) => ({
            ...current,
            markers: verificationResult.markers,
          }));
        }),

        switchMap(() =>
          from(
            this.createAndSignPresentation(
              this.credential()?.sdjwt!,
              this.requestObject()?.parsed?.client_id as string,
              this.requestObject()?.parsed?.nonce as string,
            ),
          ),
        ),
        tap((token: string) => {
          this.token.set({ token });
        }),
        catchError((error) => {
          this.token.set({ error: this.errorFormatter.format(error) });
          return EMPTY;
        }),
        switchMap(() => {
          const dcqlCredentials = this.dcql()?.query?.credentials ?? [];
          const credentialId = dcqlCredentials[0]?.id || "credential_1";

          return this.oidvpService.submitVerificationResponse(
            this.requestObject()?.parsed!,
            this.token()?.token!,
            credentialId,
          );
        }),
        tap((response: string) => {
          this.verification.update((current) => ({
            ...current,
            response,
            submitted: true,
          }));
        }),
        catchError((error) => {
          this.verification.update((current) => ({
            ...current,
            error: this.errorFormatter.formatRequestError(error, "POST"),
            submitted: true,
          }));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  public reset(): void {
    this.credential.set(undefined);
    this.deeplink.set(undefined);
    this.requestObject.set(undefined);
    this.requiredCredentials.set(undefined);
    this.requiredCredentialsError.set(undefined);
    this.payloadEncryption.set(undefined);
    this.payloadEncryptionError.set(undefined);
    this.token.set(undefined);
    this.verification.set(undefined);
    this.dcql.set(undefined);
    this.trustStatements.set(undefined);
  }

  public extractClaimsFromDcqlQuery(
    dcqlQuery: DcqlQueryDto | undefined,
  ): DcqlClaimDto[] {
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

    const headerJson = JSON.parse(
      new TextDecoder().decode(this.base64UrlDecode(jwtComponents[0])),
    );
    const payloadJson = JSON.parse(
      new TextDecoder().decode(this.base64UrlDecode(jwtComponents[1])),
    );

    this.credential.update((current) => ({
      ...current,
      decodedHeader: headerJson,
      decodedPayload: payloadJson,
    }));
  }

  private extractPayloadEncryptionStatus(
    requestObject: RequestObject,
  ): PayloadEncryptionStatus {
    const required = requestObject.response_mode === "direct_post.jwt";

    if (required && !requestObject.client_metadata?.jwks?.keys?.length) {
      throw new Error(
        "Payload encryption is required but verifier encryption JWKs are missing",
      );
    }

    if (
      required &&
      !requestObject.client_metadata?.encrypted_response_enc_values_supported
        ?.length
    ) {
      throw new Error(
        "Payload encryption is required but supported encryption methods are missing",
      );
    }

    return {
      responseMode: requestObject.response_mode,
      required,
      jwks: requestObject.client_metadata?.jwks,
      encValuesSupported:
        requestObject.client_metadata?.encrypted_response_enc_values_supported,
    };
  }

  private base64UrlDecode(input: string): Uint8Array {
    const padded = input + "==".substring(0, (4 - (input.length % 4)) % 4);
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
    nonce: string,
  ): Promise<string> {
    if (!verifierId) {
      throw new Error("Missing verifier client_id");
    }

    if (!nonce) {
      throw new Error("Missing nonce");
    }

    const requiredFields = this.extractClaimsFromDcqlQuery(this.dcql()?.query);
    const payloadJson = this.extractPayloadFromSdJwt(credentialString);
    const validationErrors = this.validateRequiredFields(
      requiredFields,
      payloadJson,
      credentialString,
    );

    if (validationErrors.length > 0) {
      throw new Error(
        `Missing required fields: ${validationErrors.join(", ")}`,
      );
    }

    const selectiveDisclosureSdJwt = await this.createSelectiveDisclosureSdJwt(
      credentialString,
      requiredFields,
    );
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

  private findCredentialKeyPair(credentialString: string): {
    privateKey: CryptoKey;
    jwk: JWK;
  } {
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
    requiredFields: DcqlClaimDto[],
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

      if (typeof claimName === "string" && disclosureExcluded.has(claimName)) {
        return;
      }

      selectedDisclosures.push(disclosure);
    });

    if (selectedDisclosures.length === 0) {
      return `${jwtPart}~`;
    }

    return `${jwtPart}~${selectedDisclosures.join("~")}~`;
  }

  private extractPayloadFromSdJwt(sdJwt: string): Record<string, unknown> {
    const jwtPart = sdJwt.split("~")[0];
    const [, payloadB64] = jwtPart.split(".");
    return JSON.parse(
      new TextDecoder().decode(this.base64UrlDecode(payloadB64)),
    ) as Record<string, unknown>;
  }

  private validateRequiredFields(
    requiredFields: DcqlClaimDto[],
    payloadJson: Record<string, unknown>,
    sdJwt: string,
  ): string[] {
    const requiredClaimNames = this.extractRequiredClaimNames(requiredFields);
    const disclosedClaimNames = this.extractDisclosureClaimNames(sdJwt);

    return Array.from(requiredClaimNames).filter((claimName) => {
      return !(claimName in payloadJson) && !disclosedClaimNames.has(claimName);
    });
  }

  private extractRequiredClaimNames(
    requiredFields: DcqlClaimDto[],
  ): Set<string> {
    const reservedClaims = new Set([
      "iss",
      "nbf",
      "exp",
      "cnf",
      "vct",
      "status",
    ]);
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
      .filter(
        (claimName): claimName is string => typeof claimName === "string",
      );

    return new Set(claimNames);
  }

  private getDCQLQueryFromRequestObject(): DcqlQueryDto {
    this.dcql.update((current) => ({
      ...current,
      response: this.requestObject()?.parsed?.dcql_query!,
    }));
    if (
      this.requestObject()?.parsed?.scope === undefined &&
      this.requestObject()?.parsed?.dcql_query !== undefined
    ) {
      return this.requestObject()?.parsed?.dcql_query!;
    } else if (
      this.requestObject()?.parsed?.scope !== undefined &&
      this.requestObject()?.parsed?.verifier_info?.length! > 1
    ) {
      const decoded = this.cryptoService.decodeIfJwt<{
        request: { query: DcqlQueryDto };
      }>(this.requestObject()?.parsed?.verifier_info?.at(1)?.data as string);

      console.log("test", decoded.request.query);

      return decoded.request.query;
    } else {
      throw new Error("Missing DCQL query");
    }
  }

  private decodeDisclosure(disclosure: string): unknown[] | undefined {
    try {
      const decoded = JSON.parse(
        new TextDecoder().decode(this.base64UrlDecode(disclosure)),
      );
      return Array.isArray(decoded) ? decoded : undefined;
    } catch {
      return undefined;
    }
  }
}
