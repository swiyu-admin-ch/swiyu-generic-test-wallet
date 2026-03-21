import { Component, inject, signal, WritableSignal } from "@angular/core";
import { SignJWT } from "jose";
import { ApiService } from "@services/api-service";
import { FormsModule } from "@angular/forms";
import { from, of, switchMap } from "rxjs";
import { ValidationPanelComponent } from "@components/validation-panel/validation-panel.component";
import { ValidationItemComponent } from "@components/validation-item/validation-item.component";
import { MatList } from "@angular/material/list";
import { MatAccordion } from "@angular/material/expansion";
import { JsonPipe, CommonModule } from "@angular/common";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { DeeplinkInput } from "../../components/deeplink-input/deeplink-input.component";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";
import { VerificationService } from "@services/verification.service";
import { HolderKeyService } from "@services/holder-key.service";
import { SdJwtDecoderService } from "@services/sd-jwt-decoder.service";
import { SdJwtStoreService } from "@services/sd-jwt-store.service";
import { Router } from "@angular/router";
import { DcqlClaimDto, DcqlCredentialDto, DcqlQueryDto, RequestObject } from "src/generated/verifier";
import { JwtPayload } from "@app/models/api-response";
import { DataViewerComponent } from "@app/components/data-viewer/data-viewer.component";

@Component({
  selector: "app-credential-verification-v2",
  imports: [
    ValidationPanelComponent,
    ValidationItemComponent,
    MatList,
    MatAccordion,
    JsonPipe,
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    DeeplinkInput,
    MatCard,
    MatCardTitle,
    MatCardContent,
    DataViewerComponent,
  ],
  templateUrl: "./credential-verification-v2.html",
  standalone: true,
})
export class CredentialVerificationV2 {
  private apiService = inject(ApiService);
  private verificationService = inject(VerificationService);
  private holderKeyService = inject(HolderKeyService);
  private sdJwtDecoder = inject(SdJwtDecoderService);
  private sdJwtStore = inject(SdJwtStoreService);
  private router = inject(Router);

  sdJwt = this.sdJwtStore.getVerificationSdJwt();

  readonly panelOpenState = signal(false);
  public input =
    "swiyu-verify://?client_id=did%3Atdw%3AQmcsWxATnPMAcbjukjXAkVAUAKRSC71mjMWjod4NVWrZ9Y%3Amockserver%253A1080%3Aapi%3Av2%3Adid%3A64f74058-4fa3-4609-a7b4-dd6a8853bc32&request_uri=http%3A%2F%2Fdefault-verifier-url.admin.ch%2Foid4vp%2Fapi%2Frequest-object%2F9eafca2d-9bae-46a2-a81d-f3576809d2c0";

  deeplink: WritableSignal<Record<string, string> | undefined> = signal(undefined);
  requestObject: WritableSignal<RequestObject | undefined> = signal(undefined);
  dcqlQuery: WritableSignal<DcqlQueryDto | undefined> = signal(undefined);
  requiredCredentials: WritableSignal<DcqlCredentialDto[] | undefined> = signal(undefined);
  credentialInput: WritableSignal<string> = signal("");
  vpToken: WritableSignal<string | undefined> = signal(undefined);
  responseSubmitted: WritableSignal<boolean | undefined> = signal(undefined);

  credentialValid: WritableSignal<boolean> = signal(false);
  credentialValidationError: WritableSignal<string | undefined> = signal(undefined);
  decodedHeader: WritableSignal<JwtPayload | undefined> = signal(undefined);
  decodedPayload: WritableSignal<JwtPayload | undefined> = signal(undefined);

  encryptionRequired: WritableSignal<boolean | undefined> = signal(undefined);

  constructor(
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state?.["credential"]) {
      this.credentialInput.set(navigation.extras.state["credential"]);
    }
  }

  public onClear(): void {
    this.reset();
  }

  public onResolve(input: string): void {
    this.reset();

    if (!this.validateCredential()) {
      console.error("Credential validation failed");
      return;
    }

    const decodedDeeplink: Record<string, string> =
      this.verificationService.decodeDeeplink(input) as Record<string, string>;
    this.deeplink.set(decodedDeeplink);

    this.apiService
      .resolveRequestObjectFromDeeplink(decodedDeeplink?.["request_uri"])
      .pipe(
        switchMap((requestObject: JwtPayload) => {
          const reqObj = requestObject as unknown as RequestObject;
          this.requestObject.set(reqObj);
          this.dcqlQuery.set(reqObj?.dcql_query);
          this.encryptionRequired.set(requestObject?.["response_mode"] === 'direct_post.jwt');

          const requiredCredentials = this.verificationService.extractCredentialsFromDCQL(reqObj?.dcql_query as DcqlQueryDto);
          this.requiredCredentials.set(requiredCredentials);

          const credentialString = this.credentialInput();
          if (!credentialString?.trim()) {
            const error = "No credential provided";
            console.error(error);
            this.credentialValidationError.set(error);
            return of(null);
          }

          const requiredFields = this.extractClaimsFromDcqlQuery(reqObj?.dcql_query);
          const payloadJson = this.extractPayloadFromSdJwt(credentialString);
          const validationErrors = this.validateRequiredFields(requiredFields, payloadJson);

          if (validationErrors.length > 0) {
            const errorMsg = `Missing required fields: ${validationErrors.join(', ')}`;
            console.error(errorMsg);
            this.credentialValidationError.set(errorMsg);
            return of(null);
          }

          const clientId = reqObj?.client_id as string;
          return from(this.createAndSignPresentation(
            credentialString,
            clientId,
            reqObj?.nonce as string
          ));
        }),

        switchMap((vpToken: string | null) => {
          if (!vpToken) {
            return of(null);
          }

          this.vpToken.set(vpToken);
          const dcqlCredentials = this.dcqlQuery()?.credentials || [];
          const credentialId = (dcqlCredentials[0]?.id as string) || "credential_1";

          return this.apiService.submitVerificationResponseDcql(
            this.requestObject()!,
            vpToken,
            credentialId
          );
        })
      )
      .subscribe({
        next: (response) => {
          console.debug("Verification response submitted successfully", response);
          this.responseSubmitted.set(true);
        },
        error: (error: Error) => {
          console.error("Verification process failed:", error.message);
          this.responseSubmitted.set(false);
          this.credentialValidationError.set(error.message);
        }
      });
  }

  public reset(): void {
    this.deeplink.set(undefined);
    this.requestObject.set(undefined);
    this.dcqlQuery.set(undefined);
    this.requiredCredentials.set(undefined);
    this.vpToken.set(undefined);
    this.responseSubmitted.set(undefined);
    this.credentialValid.set(false);
    this.credentialValidationError.set(undefined);
    this.decodedHeader.set(undefined);
    this.decodedPayload.set(undefined);
  }

  private validateCredential(): boolean {
    try {
      const credentialString = this.credentialInput();
      if (!credentialString || credentialString.trim() === "") {
        this.credentialValidationError.set("No credential provided");
        this.credentialValid.set(false);
        return false;
      }

      if (!credentialString.includes('~')) {
        this.credentialValidationError.set("Invalid SD-JWT format: missing tilde separator");
        this.credentialValid.set(false);
        return false;
      }

      const parts = credentialString.split('~');
      const jwtPart = parts[0];
      const jwtComponents = jwtPart.split('.');

      if (jwtComponents.length !== 3) {
        this.credentialValidationError.set("Invalid JWT format: expected 3 components");
        this.credentialValid.set(false);
        return false;
      }

      try {
        const headerJson = JSON.parse(
          new TextDecoder().decode(this.base64UrlDecode(jwtComponents[0]))
        );
        const payloadJson = JSON.parse(
          new TextDecoder().decode(this.base64UrlDecode(jwtComponents[1]))
        );

        this.decodedHeader.set(headerJson);
        this.decodedPayload.set(payloadJson);
        this.credentialValid.set(true);
        this.credentialValidationError.set(undefined);
        return true;
      } catch (e) {
        this.credentialValidationError.set("Failed to decode credential: " + (e as Error).message);
        this.credentialValid.set(false);
        return false;
      }
    } catch (error) {
      this.credentialValidationError.set("Credential validation error: " + (error as Error).message);
      this.credentialValid.set(false);
      return false;
    }
  }

  private base64UrlDecode(input: string): Uint8Array {
    const padded = input + '=='.substring(0, (4 - input.length % 4) % 4);
    const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
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
    const originalSdJwt = credentialString;

    const requiredFields = this.extractClaimsFromDcqlQuery(this.dcqlQuery());

    const selectiveDisclosureSdJwt = await this.createSelectiveDisclosureSdJwt(
      originalSdJwt,
      requiredFields
    );

    const sdHash = await this.calculateSdHash(selectiveDisclosureSdJwt);

    const kbJwtPayload: Record<string, unknown> = {
      sd_hash: sdHash,
      aud: [verifierId],
      nonce: nonce,
      iat: Math.floor(new Date().getTime() / 1000)
    };

    const kbJwt = await new SignJWT(kbJwtPayload)
      .setProtectedHeader({
        alg: "ES256",
        typ: "kb+jwt",
      })
      .setAudience(verifierId)
      .setIssuedAt(new Date())
      .sign(this.holderKeyService.getPrivateKey());

    return `${selectiveDisclosureSdJwt}${kbJwt}`;
  }

  public extractClaimsFromDcqlQuery(
    dcqlQuery: DcqlQueryDto | undefined
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

        const pathKey = claim.path.join('|');

        if (!seenPaths.has(pathKey)) {
          seenPaths.add(pathKey);
          extractedClaims.push(claim);
        }
      });
    });

    return extractedClaims;
  }

  private async calculateSdHash(sdJwtPresentation: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(sdJwtPresentation);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    const hashBase64Standard = btoa(String.fromCharCode.apply(null, hashArray as unknown as number[]));

    return hashBase64Standard
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private async createSelectiveDisclosureSdJwt(
    fullSdJwt: string,
    requiredFields: DcqlClaimDto[]
  ): Promise<string> {

    const DISCLOSURE_EXCLUDED = new Set(['iss', 'nbf', 'exp', 'cnf', 'status']);

    const requiredClaimNames = new Set(
      requiredFields
        .map(c => c.path)
        .reduce((acc, p) => acc.concat(p ?? []), [])
        .filter((p): p is string => typeof p === 'string')
    );

    const parts = fullSdJwt.split('~');
    const jwtPart = parts[0];
    const disclosureParts = parts.slice(1, -1);

    const selectedDisclosures: string[] = [];

    disclosureParts.forEach((disclosure: string, index: number) => {
      try {
        if (!disclosure) return;

        const decodedDisclosure = JSON.parse(
          new TextDecoder().decode(this.base64UrlDecode(disclosure))
        ) as (string | unknown)[];

        if (Array.isArray(decodedDisclosure) && decodedDisclosure.length >= 2) {
          const claimName = decodedDisclosure[1] as string;

          if (DISCLOSURE_EXCLUDED.has(claimName)) {
            return;
          }

          if (requiredClaimNames.has(claimName)) {
            selectedDisclosures.push(disclosure);
          }
        }
      } catch (e) {
        console.warn(`Failed to parse disclosure ${index}:`, e);
      }
    });

    let presentation = jwtPart;
    if (selectedDisclosures.length > 0) {
      presentation += '~' + selectedDisclosures.join('~') + '~';
    } else {
      presentation += '~';
    }

    return presentation;
  }

  private extractPayloadFromSdJwt(sdJwt: string): Record<string, unknown> {
    try {
      const parts = sdJwt.split('~');
      const jwtPart = parts[0];
      const [, payloadB64] = jwtPart.split('.');
      return JSON.parse(
        new TextDecoder().decode(this.base64UrlDecode(payloadB64))
      ) as Record<string, unknown>;
    } catch (error) {
      console.error("Failed to extract payload from SD-JWT:", error);
      return {};
    }
  }

  private validateRequiredFields(requiredFields: DcqlClaimDto[], payloadJson: Record<string, unknown>): string[] {
    const RESERVED_CLAIMS = new Set(['iss', 'nbf', 'exp', 'cnf', 'vct', 'status']);

    const requiredClaimNames = requiredFields
      .flatMap(claim => Array.isArray(claim.path) ? claim.path : [])
      .filter((p): p is string => typeof p === 'string')
      .filter(p => !RESERVED_CLAIMS.has(p));


    const missingFields = requiredClaimNames.filter((claimName) => {
      if (claimName in payloadJson) {
        return false;
      }

      return !(payloadJson["_sd"] && Array.isArray(payloadJson["_sd"]) && payloadJson["_sd"].length > 0);
    });

    if (missingFields.length > 0) {
      console.warn('Missing required fields:', missingFields);
    }

    return missingFields;
  }

}
