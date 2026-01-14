import { Component, OnInit, signal, WritableSignal } from "@angular/core";
import { JWK, SignJWT } from "jose";
import { ApiService } from "../api-service";
import { FormsModule } from "@angular/forms";
import { from, of, switchMap } from "rxjs";
import { PanelComponent } from "../deeplink-resolver/panel.component";
import { ChecklistEntry } from "../checklist-entry/checklist-entry";
import { MatList } from "@angular/material/list";
import { MatAccordion } from "@angular/material/expansion";
import { JsonPipe, DatePipe, SlicePipe, CommonModule } from "@angular/common";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { CredentialService } from "../creddential.service";
import { DeeplinkInput } from "../deeplink-input/deeplink-input";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";
import { VerificationService } from "@services/verification.service";
import { WalletService } from "@services/wallet.service";

@Component({
  selector: "app-credential-verification-v1",
  imports: [
    PanelComponent,
    ChecklistEntry,
    MatList,
    MatAccordion,
    JsonPipe,
    DatePipe,
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
  templateUrl: "./credential-verification-v1.html",
  standalone: true,
})
export class CredentialVerificationV1 implements OnInit {
  readonly panelOpenState = signal(false);
  public input =
    "swiyu-verify://?client_id=did%3Atdw%3AQmcsWxATnPMAcbjukjXAkVAUAKRSC71mjMWjod4NVWrZ9Y%3Amockserver%253A1080%3Aapi%3Av1%3Adid%3A64f74058-4fa3-4609-a7b4-dd6a8853bc32&request_uri=http%3A%2F%2Fdefault-verifier-url.admin.ch%2Foid4vp%2Fapi%2Frequest-object%2F9eafca2d-9bae-46a2-a81d-f3576809d2c0";

  deeplink: WritableSignal<undefined | any> = signal(undefined);
  requestObject: WritableSignal<undefined | any> = signal(undefined);
  presentationDefinition: WritableSignal<undefined | any> = signal(undefined);
  requiredClaims: WritableSignal<undefined | any[]> = signal(undefined);
  selectedCredential: WritableSignal<undefined | any> = signal(undefined);
  vpToken: WritableSignal<undefined | string> = signal(undefined);
  responseSubmitted: WritableSignal<boolean> = signal(false);

  private privateKey: CryptoKey;
  private jwk: JWK;

  constructor(
    private apiService: ApiService,
    private credentialService: CredentialService,
    private verificationService: VerificationService,
    private walletService: WalletService
  ) {}

  public onResolve(input: string): void {
    this.reset();

    let requestUri: string;
    let decodedDeeplink: any = {};

    if (input.startsWith('swiyu-verify://')) {
      decodedDeeplink = this.verificationService.decodeDeeplink(input);
      requestUri = decodedDeeplink?.request_uri;
    } else {
      requestUri = input;
    }

    if (!requestUri) {
      console.error("No request_uri found in input");
      return;
    }

    this.apiService
      .resolveRequestObjectFromDeeplink(requestUri)
      .pipe(
        switchMap((requestObject: any) => {
          console.log("Request object received:", requestObject);
          this.requestObject.set(requestObject);
          this.presentationDefinition.set(requestObject?.presentation_definition);

          const requiredClaims = this.verificationService.extractRequiredClaimsFromPresentationDefinition(
            requestObject?.presentation_definition
          );
          this.requiredClaims.set(requiredClaims);

          const credential = this.walletService.getFirstCredential();
          if (!credential) {
            return of(null);
          }

          this.selectedCredential.set(credential);
          console.log("Selected credential from wallet:", credential);

          this.privateKey = credential.privateKey;
          this.jwk = credential.jwk;

          const clientId = decodedDeeplink?.client_id || requestObject?.client_id;

          return from(this.createAndSignPresentation(
            credential,
            clientId,
            requestObject?.nonce
          ));
        }),
        switchMap((vpToken: any) => {
          if (!vpToken) {
            return of(null);
          }
          this.vpToken.set(vpToken);
          console.log("VP Token created:", vpToken);

          const presentationSubmission = this.createPresentationSubmission(
            this.requestObject()?.presentation_definition
          );

          return this.apiService.submitVerificationResponse(
            requestUri,
            vpToken,
            presentationSubmission
          );
        })
      )
      .subscribe({
        next: (response) => {
          console.log("Verification response submitted successfully:", response);
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
    this.selectedCredential.set(undefined);
    this.vpToken.set(undefined);
    this.responseSubmitted.set(false);
  }

  private async createAndSignPresentation(
    credential: any,
    verifierId: string,
    nonce: string
  ): Promise<string> {
    const sdJwt = credential.credential;

    const sdHash = await this.calculateSdHash(sdJwt);

    const kbJwt = await this.createKeyBinding(
      verifierId,
      nonce,
      sdHash,
      this.privateKey,
      this.jwk
    );

    const presentation = `${sdJwt}~${kbJwt}`;

    return presentation;
  }

  private async calculateSdHash(sdJwt: string): Promise<string> {
    const lastTildeIndex = sdJwt.lastIndexOf('~');
    const sdJwtToHash = sdJwt.substring(0, lastTildeIndex + 1);

    const encoder = new TextEncoder();
    const data = encoder.encode(sdJwtToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64Standard = btoa(String.fromCharCode.apply(null, hashArray));

    const hashBase64Url = hashBase64Standard
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return hashBase64Url;
  }

  private async createKeyBinding(
    audience: string,
    nonce: string,
    sdHash: string,
    privateKey: CryptoKey,
    jwk: any
  ): Promise<string> {
    const claims = {
      "sd_hash": sdHash,
      "aud": audience,
      "nonce": nonce,
      "iat": Math.floor(Date.now() / 1000)
    };

    const kbJwt = await new SignJWT(claims)
      .setProtectedHeader({
        alg: "ES256",
        typ: "kb+jwt"
      })
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .sign(privateKey);


    return kbJwt;
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
}
