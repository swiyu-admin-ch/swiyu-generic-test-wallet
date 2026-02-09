import { Component, inject, signal, WritableSignal } from "@angular/core";
import { SignJWT } from "jose";
import { ApiService } from "../api-service";
import { FormsModule } from "@angular/forms";
import { from, of, switchMap } from "rxjs";
import { PanelComponent } from "../deeplink-resolver/panel.component";
import { ChecklistEntry } from "../checklist-entry/checklist-entry";
import { MatList } from "@angular/material/list";
import { MatAccordion } from "@angular/material/expansion";
import { JsonPipe, SlicePipe, CommonModule } from "@angular/common";
import { MatFormField, MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { CredentialService } from "@services/credential.service";
import { DeeplinkInput } from "../deeplink-input/deeplink-input";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";
import { VerificationService } from "@services/verification.service";
import { HolderKeyService } from "@services/holder-key.service";
import { Router } from "@angular/router";
import { RequestObject } from "src/generated/verifier";

@Component({
  selector: "app-credential-verification-v1",
  imports: [
    PanelComponent,
    ChecklistEntry,
    MatList,
    MatAccordion,
    JsonPipe,
    SlicePipe,
    CommonModule,
    MatFormFieldModule,
    MatFormField,
    MatInputModule,
    FormsModule,
    DeeplinkInput,
    MatCard,
    MatCardTitle,
    MatCardContent,
  ],
  templateUrl: "./credential-verification-v1.html",
  standalone: true,
})
export class CredentialVerificationV1 {
  private apiService = inject(ApiService);
  private credentialService = inject(CredentialService);
  private verificationService = inject(VerificationService);
  private holderKeyService = inject(HolderKeyService);
  private router = inject(Router);

  readonly panelOpenState = signal(false);
  public input =
    "swiyu-verify://?client_id=did%3Atdw%3AQmcsWxATnPMAcbjukjXAkVAUAKRSC71mjMWjod4NVWrZ9Y%3Amockserver%253A1080%3Aapi%3Av1%3Adid%3A64f74058-4fa3-4609-a7b4-dd6a8853bc32&request_uri=http%3A%2F%2Fdefault-verifier-url.admin.ch%2Foid4vp%2Fapi%2Frequest-object%2F9eafca2d-9bae-46a2-a81d-f3576809d2c0";

  deeplink: WritableSignal<undefined | any> = signal(undefined);
  requestObject: WritableSignal<undefined | any> = signal(undefined);
  presentationDefinition: WritableSignal<undefined | any> = signal(undefined);
  requiredClaims: WritableSignal<undefined | any[]> = signal(undefined);
  credentialInput: WritableSignal<string> = signal("");
  vpToken: WritableSignal<undefined | string> = signal(undefined);
  responseSubmitted: WritableSignal<boolean> = signal(false);

  credentialValid: WritableSignal<boolean> = signal(false);
  credentialValidationError: WritableSignal<string | undefined> = signal(undefined);
  decodedHeader: WritableSignal<any> = signal(undefined);
  decodedPayload: WritableSignal<any> = signal(undefined);
  presentedClaims: WritableSignal<any> = signal(undefined);

  constructor() {
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

    const decodedDeeplink: any =
      this.verificationService.decodeDeeplink(input);
    this.deeplink.set(decodedDeeplink);

    const credentialString = this.credentialInput();
    if (!credentialString || credentialString.trim() === "") {
      console.error("No credential provided");
      return;
    }

    this.apiService
      .resolveRequestObjectFromDeeplink(decodedDeeplink?.request_uri)
      .pipe(
        switchMap((requestObject: RequestObject) => {
          this.requestObject.set(requestObject);
          this.presentationDefinition.set(requestObject?.presentation_definition);

          const requiredClaims = this.verificationService.extractRequiredClaimsFromPresentationDefinition(
            requestObject?.presentation_definition
          );
          this.requiredClaims.set(requiredClaims);

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
          const presentationSubmission = this.createPresentationSubmission(
            this.requestObject()?.presentation_definition
          );

          return this.apiService.submitVerificationResponse(
            this.requestObject()?.response_uri,
            vpToken,
            presentationSubmission
          );
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
    this.presentationDefinition.set(undefined);
    this.requiredClaims.set(undefined);
    this.vpToken.set(undefined);
    this.responseSubmitted.set(false);
    this.credentialValid.set(false);
    this.credentialValidationError.set(undefined);
    this.decodedHeader.set(undefined);
    this.decodedPayload.set(undefined);
    this.presentedClaims.set(undefined);
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

  private async createAndSignPresentation(
    credentialString: string,
    verifierId: string,
    nonce: string
  ): Promise<string> {

    const originalSdJwt = credentialString;

    const requiredFields = this.extractFieldPathsFromPresentationDefinition(
      this.requestObject()?.presentation_definition
    );

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

  private async calculateSdHash(sdJwtPresentation: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(sdJwtPresentation);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    const hashArray = Array.from(new Uint8Array(hashBuffer));

    const hashBase64Standard = btoa(String.fromCharCode.apply(null, hashArray));

    const hashBase64Url = hashBase64Standard
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');


    return hashBase64Url;
  }

  private createPresentationSubmission(presentationDefinition: any): any {
    if (!presentationDefinition?.input_descriptors) {
      return {
        id: "presentation_submission",
        definition_id: presentationDefinition?.id || "default",
        descriptor_map: []
      };
    }

    const descriptorMap = presentationDefinition.input_descriptors.map((descriptor: any) => ({
      id: descriptor.id,
      format: "vc+sd-jwt",
      path: "$"
    }));

    return {
      id: presentationDefinition?.id || "presentation_submission",
      definition_id: presentationDefinition?.id || "default",
      descriptor_map: descriptorMap
    };
  }

  private extractFieldPathsFromPresentationDefinition(presentationDefinition: any): string[] {
    const fieldPaths: string[] = [];

    if (!presentationDefinition) {
      return fieldPaths;
    }

    if (presentationDefinition.input_descriptors) {
      presentationDefinition.input_descriptors.forEach((descriptor: any) => {
        if (descriptor.constraints?.fields) {
          descriptor.constraints.fields.forEach((field: any) => {
            if (field.path && Array.isArray(field.path)) {
              field.path.forEach((path: string) => {
                const claimName = path.replace(/^\$\./, '');
                if (claimName && !fieldPaths.includes(claimName)) {
                  fieldPaths.push(claimName);
                }
              });
            }
          });
        }
      });
    }

    return fieldPaths;
  }

  private async createSelectiveDisclosureSdJwt(
    fullSdJwt: string,
    requiredFields: string[]
  ): Promise<string> {
    try {
      const parts = fullSdJwt.split('~');
      const jwtPart = parts[0];
      const disclosureParts = parts.slice(1, -1);
      if (disclosureParts.length === 0) {
        const [, payloadB64] = jwtPart.split('.');
        const payloadJson = JSON.parse(
          new TextDecoder().decode(
            this.base64UrlDecode(payloadB64)
          )
        );
        return await this.createSdJwtWithDisclosures(jwtPart, payloadJson, requiredFields);
      }

      const selectedDisclosures: string[] = [];

      disclosureParts.forEach((disclosure: string, index: number) => {
        try {
          if (!disclosure) {
            console.warn("Empty disclosure at index:", index);
            return;
          }

          const decodedDisclosure = JSON.parse(
            new TextDecoder().decode(
              this.base64UrlDecode(disclosure)
            )
          );

          if (Array.isArray(decodedDisclosure) && decodedDisclosure.length >= 2) {
            const claimName = decodedDisclosure[1];
            if (requiredFields.includes(claimName)) {
              selectedDisclosures.push(disclosure);
            }
          }
        } catch (e) {
          console.warn("Could not parse disclosure at index", index, ":", e);
        }
      });

      let presentation = jwtPart;
      if (selectedDisclosures.length > 0) {
        presentation += '~' + selectedDisclosures.join('~') + '~';
      } else {
        presentation += '~';
      }
      return presentation;

    } catch (error) {
      console.error("Error creating selective disclosure SD-JWT:", error);
      return fullSdJwt;
    }
  }

  private async createSdJwtWithDisclosures(
    jwtPart: string,
    payloadJson: any,
    requiredFields: string[]
  ): Promise<string> {
    const disclosures: string[] = [];

    requiredFields.forEach((fieldName: string) => {
      if (fieldName in payloadJson) {
        const value = payloadJson[fieldName];
        const salt = this.generateRandomSalt();

        const disclosure = [salt, fieldName, value];
        const disclosureJson = JSON.stringify(disclosure);
        const disclosureB64Url = this.base64UrlEncode(disclosureJson);

        disclosures.push(disclosureB64Url);
      }
    });

    let sdJwtWithDisclosures = jwtPart;
    if (disclosures.length > 0) {
      sdJwtWithDisclosures += '~' + disclosures.join('~') + '~';
    } else {
      sdJwtWithDisclosures += '~';
    }

    return sdJwtWithDisclosures;
  }

  private generateRandomSalt(): string {
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    let binary = '';
    // for (let i = 0; i < saltBytes.length; i++) {
    //   binary += String.fromCharCode(saltBytes[i]);
    // }
    saltBytes.forEach(saltByte => {
      binary += String.fromCharCode(saltByte);
    });
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private base64UrlEncode(input: string): string {
    const bytes = new TextEncoder().encode(input);
    let binary = '';
    // for (let i = 0; i < bytes.length; i++) {
    //   binary += String.fromCharCode(bytes[i]);
    // }
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
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
}
