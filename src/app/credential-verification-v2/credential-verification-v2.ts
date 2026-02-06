import { Component, signal, WritableSignal } from "@angular/core";
import { SignJWT, CompactEncrypt, importJWK } from "jose";
import { ApiService } from "../api-service";
import { FormsModule } from "@angular/forms";
import { from, of, switchMap, throwError } from "rxjs";
import { PanelComponent } from "../deeplink-resolver/panel.component";
import { ChecklistEntry } from "../checklist-entry/checklist-entry";
import { MatList } from "@angular/material/list";
import { MatAccordion } from "@angular/material/expansion";
import { JsonPipe, SlicePipe, CommonModule } from "@angular/common";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { DeeplinkInput } from "../deeplink-input/deeplink-input";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";
import { VerificationService } from "@services/verification.service";
import { HolderKeyService } from "@services/holder-key.service";
import { Router } from "@angular/router";

@Component({
  selector: "app-credential-verification-v2",
  imports: [
    PanelComponent,
    ChecklistEntry,
    MatList,
    MatAccordion,
    JsonPipe,
    SlicePipe,
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    DeeplinkInput,
    MatCard,
    MatCardTitle,
    MatCardContent,
  ],
  templateUrl: "./credential-verification-v2.html",
  standalone: true,
})
export class CredentialVerificationV2 {
  readonly panelOpenState = signal(false);
  public input =
    "swiyu-verify://?client_id=did%3Atdw%3AQmcsWxATnPMAcbjukjXAkVAUAKRSC71mjMWjod4NVWrZ9Y%3Amockserver%253A1080%3Aapi%3Av2%3Adid%3A64f74058-4fa3-4609-a7b4-dd6a8853bc32&request_uri=http%3A%2F%2Fdefault-verifier-url.admin.ch%2Foid4vp%2Fapi%2Frequest-object%2F9eafca2d-9bae-46a2-a81d-f3576809d2c0";

  deeplink: WritableSignal<undefined | any> = signal(undefined);
  requestObject: WritableSignal<undefined | any> = signal(undefined);
  dcqlQuery: WritableSignal<undefined | any> = signal(undefined);
  requiredCredentials: WritableSignal<undefined | any[]> = signal(undefined);
  credentialInput: WritableSignal<string> = signal("");
  vpToken: WritableSignal<undefined | string> = signal(undefined);
  responseSubmitted: WritableSignal<boolean> = signal(false);

  credentialValid: WritableSignal<boolean> = signal(false);
  credentialValidationError: WritableSignal<string | undefined> = signal(undefined);
  decodedHeader: WritableSignal<any> = signal(undefined);
  decodedPayload: WritableSignal<any> = signal(undefined);

  // Encryption related signals
  encryptionRequired: WritableSignal<boolean> = signal(false);
  encryptionSupported: WritableSignal<boolean> = signal(false);
  encryptionAlgorithm: WritableSignal<string | undefined> = signal(undefined);
  encryptionMethod: WritableSignal<string | undefined> = signal(undefined);
  encryptedResponse: WritableSignal<string | undefined> = signal(undefined);
  encryptionError: WritableSignal<string | undefined> = signal(undefined);

  constructor(
    private apiService: ApiService,
    private verificationService: VerificationService,
    private holderKeyService: HolderKeyService,
    private router: Router
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state?.credential) {
      this.credentialInput.set(navigation.extras.state.credential);
    }
  }

  public onResolve(input: string): void {
    this.reset();

    if (!this.validateCredential()) {
      console.error("Credential validation failed");
      return;
    }

    let decodedDeeplink: any =
      this.verificationService.decodeDeeplink(input);
    this.deeplink.set(decodedDeeplink);


    this.apiService
      .resolveRequestObjectFromDeeplink(decodedDeeplink?.request_uri)
      .pipe(
        switchMap((requestObject: any) => {
          this.requestObject.set(requestObject);
          this.dcqlQuery.set(requestObject?.dcql_query);

          this.checkEncryptionRequirements(requestObject);

          const requiredCredentials = this.verificationService.extractCredentialsFromDCQL(
            requestObject?.dcql_query
          );
          this.requiredCredentials.set(requiredCredentials);

          const credentialString = this.credentialInput();
          if (!credentialString || credentialString.trim() === "") {
            console.error("No credential provided");
            return of(null);
          }

          const requiredFields = this.extractFieldPathsFromDCQL(requestObject?.dcql_query);
          const payloadJson = this.extractPayloadFromSdJwt(credentialString);
          const validationErrors = this.validateRequiredFields(requiredFields, payloadJson);

          if (validationErrors.length > 0) {
            this.credentialValidationError.set(`Missing required fields: ${validationErrors.join(', ')}`);
            return of(null);
          }

          const clientId = requestObject?.client_id;

          return from(this.createAndSignPresentation(
            credentialString,
            clientId,
            requestObject?.nonce
          ));
        }),
        switchMap((vpToken: any) => {
          if (!vpToken) {
            return of(null);
          }
          this.vpToken.set(vpToken);
          const dcqlCredentials = this.dcqlQuery()?.credentials || [];
          const credentialId = dcqlCredentials[0]?.id || "credential_1";

          if (this.encryptionRequired()) {
            return from(this.encryptPayload(vpToken, this.requestObject()?.client_metadata))
              .pipe(
                switchMap((encryptedToken: string | null) => {
                  if (!encryptedToken) {
                    console.error("Failed to encrypt payload");
                    return throwError(() => new Error("Encryption failed"));
                  }
                  return this.apiService.submitVerificationResponseDcqlEncrypted(
                    this.requestObject()?.response_uri,
                    encryptedToken
                  );
                })
              );
          } else {
            return this.apiService.submitVerificationResponseDcql(
              this.requestObject()?.response_uri,
              vpToken,
              credentialId,
              false,
              undefined
            );
          }
        })
      )
      .subscribe({
        next: () => {
          this.responseSubmitted.set(true);
        },
        error: (error) => {
          console.error("Error during verification process:", error);
        }
      });
  }

  public reset(): void {
    this.deeplink.set(undefined);
    this.requestObject.set(undefined);
    this.dcqlQuery.set(undefined);
    this.requiredCredentials.set(undefined);
    this.vpToken.set(undefined);
    this.responseSubmitted.set(false);
    this.credentialValid.set(false);
    this.credentialValidationError.set(undefined);
    this.decodedHeader.set(undefined);
    this.decodedPayload.set(undefined);
    this.encryptionRequired.set(false);
    this.encryptionSupported.set(false);
    this.encryptionAlgorithm.set(undefined);
    this.encryptionMethod.set(undefined);
    this.encryptedResponse.set(undefined);
    this.encryptionError.set(undefined);
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

    const requiredFields = this.extractFieldPathsFromDCQL(this.dcqlQuery());



    const selectiveDisclosureSdJwt = await this.createSelectiveDisclosureSdJwt(
      originalSdJwt,
      requiredFields
    );

    const sdHash = await this.calculateSdHash(selectiveDisclosureSdJwt);

    const kbJwtPayload = {
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

    const vpToken = `${selectiveDisclosureSdJwt}${kbJwt}`;

    return vpToken;
  }

  private extractFieldPathsFromDCQL(dcqlQuery: any): string[] {
    const DISCLOSURE_EXCLUDED = new Set(['iss', 'nbf', 'exp', 'cnf', 'status']);
    const fieldPaths: string[] = [];

    if (!dcqlQuery?.credentials) {
      return fieldPaths;
    }

    dcqlQuery.credentials.forEach((credential: any) => {
      credential.claims?.forEach((claim: any) => {
        if (claim.path && Array.isArray(claim.path)) {
          claim.path.forEach((pathElement: any) => {
            if (typeof pathElement === 'string') {
              const claimName = pathElement.replace(/^\$\./, '');
              if (!DISCLOSURE_EXCLUDED.has(claimName)) {
                if (!fieldPaths.includes(claimName)) {
                  fieldPaths.push(claimName);
                }
              }
            }
          });
        }
      });
    });

    console.log("DCQL – Extracted required fields:", fieldPaths);
    return fieldPaths;
  }



  private async calculateSdHash(sdJwtPresentation: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(sdJwtPresentation);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    const hashBase64Standard = btoa(String.fromCharCode.apply(null, hashArray as any));

    const hashBase64Url = hashBase64Standard
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return hashBase64Url;
  }

  private async createSelectiveDisclosureSdJwt(
    fullSdJwt: string,
    requiredFields: string[]
  ): Promise<string> {
    const DISCLOSURE_EXCLUDED = new Set(['iss', 'nbf', 'exp', 'cnf', 'status']);

    const parts = fullSdJwt.split('~');
    const jwtPart = parts[0];
    const disclosureParts = parts.slice(1, -1);

    const selectedDisclosures: string[] = [];
    const foundClaims: string[] = [];
    const disclosureDetails: any[] = [];

    disclosureParts.forEach((disclosure: string, index: number) => {
      try {
        if (!disclosure) return;

        const decodedDisclosure = JSON.parse(
          new TextDecoder().decode(
            this.base64UrlDecode(disclosure)
          )
        );

        if (Array.isArray(decodedDisclosure) && decodedDisclosure.length >= 2) {
          const claimName = decodedDisclosure[1];

          if (DISCLOSURE_EXCLUDED.has(claimName)) {
            return;
          }

          if (requiredFields.includes(claimName)) {
            selectedDisclosures.push(disclosure);
            foundClaims.push(claimName);
            disclosureDetails.push({
              claimName,
              value: decodedDisclosure[2],
              encoded: disclosure.substring(0, 30) + "..."
            });
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

    console.log("Final presentation format: JWT~disc1~disc2~...~");
    return presentation;
  }



  private extractPayloadFromSdJwt(sdJwt: string): any {
    try {
      const parts = sdJwt.split('~');
      const jwtPart = parts[0];
      const [, payloadB64] = jwtPart.split('.');
      return JSON.parse(
        new TextDecoder().decode(this.base64UrlDecode(payloadB64))
      );
    } catch (error) {
      console.error("Failed to extract payload from SD-JWT:", error);
      return {};
    }
  }

  private validateRequiredFields(requiredFields: string[], payloadJson: any): string[] {
    const RESERVED_CLAIMS = new Set(['iss', 'nbf', 'exp', 'cnf', 'vct', 'status']);
    const missingFields: string[] = [];

    requiredFields.forEach((field) => {
      if (RESERVED_CLAIMS.has(field)) {
        return;
      }

      if (field in payloadJson) {
        return;
      }

      if (payloadJson._sd && Array.isArray(payloadJson._sd) && payloadJson._sd.length > 0) {
        return;
      }

      missingFields.push(field);
    });

    if (missingFields.length > 0) {
      console.warn("Missing required fields:", missingFields);
    }

    return missingFields;
  }

  private checkEncryptionRequirements(requestObject: any): void {
    const responseMode = requestObject?.response_mode;
    const clientMetadata = requestObject?.client_metadata;

    const isDirectPostJwt = responseMode === "direct_post.jwt";

    const hasEncryptionJwks = clientMetadata?.jwks?.keys && clientMetadata.jwks.keys.length > 0;
    const hasEncryptionMethods = clientMetadata?.encrypted_response_enc_values_supported &&
                                  clientMetadata.encrypted_response_enc_values_supported.length > 0;

    const encryptionRequired = isDirectPostJwt && hasEncryptionJwks && hasEncryptionMethods;

    this.encryptionRequired.set(encryptionRequired);

    if (encryptionRequired) {
      try {
        const encryptionJwk = clientMetadata.jwks.keys[0];
        const encryptionAlg = encryptionJwk.alg || "ECDH-ES";
        const encryptionEnc = clientMetadata.encrypted_response_enc_values_supported[0] || "A128GCM";

        this.encryptionAlgorithm.set(encryptionAlg);
        this.encryptionMethod.set(encryptionEnc);
        this.encryptionSupported.set(true);

        console.log("Encryption requirements detected:", {
          algorithm: encryptionAlg,
          method: encryptionEnc,
          keyType: encryptionJwk.kty,
          curve: encryptionJwk.crv
        });
      } catch (error) {
        this.encryptionError.set("Failed to parse encryption requirements: " + (error as Error).message);
        console.error("Error parsing encryption requirements:", error);
      }
    }
  }

  public async encryptPayload(vpToken: string, clientMetadata: any): Promise<string | null> {
    try {
      if (!clientMetadata?.jwks?.keys || clientMetadata.jwks.keys.length === 0) {
        this.encryptionError.set("No encryption keys available");
        return null;
      }

      const encryptionJwk = clientMetadata.jwks.keys[0];
      const encryptionAlg = encryptionJwk.alg || "ECDH-ES";
      const encryptionEnc = clientMetadata.encrypted_response_enc_values_supported?.[0] || "A128GCM";

      const publicKey = await importJWK(encryptionJwk, encryptionAlg);

      const dcqlCredentials = this.dcqlQuery()?.credentials || [];
      const credentialId = dcqlCredentials[0]?.id || "credential_1";
      const vpTokenMap: { [key: string]: string[] } = {
        [credentialId]: [vpToken]
      };

      const payload = JSON.stringify({
        vp_token: vpTokenMap
      });

      const encryptedJwe = await new CompactEncrypt(
        new TextEncoder().encode(payload)
      )
        .setProtectedHeader({
          alg: encryptionAlg,
          enc: encryptionEnc,
          typ: "JWT",
          kid: encryptionJwk.kid
        })
        .encrypt(publicKey);

      this.encryptedResponse.set(encryptedJwe);
      console.log("Payload encrypted successfully");

      return encryptedJwe;
    } catch (error) {
      const errorMessage = "Failed to encrypt payload: " + (error as Error).message;
      this.encryptionError.set(errorMessage);
      console.error("Encryption error:", error);
      return null;
    }
  }

}
