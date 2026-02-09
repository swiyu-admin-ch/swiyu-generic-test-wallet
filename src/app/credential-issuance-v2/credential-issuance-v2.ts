import { Component, inject, signal, WritableSignal } from "@angular/core";
import * as jose from "jose";
import { Credential } from "../credential/credential";
import { ApiService } from "../api-service";
import { FormsModule } from "@angular/forms";
import { from, of, switchMap } from "rxjs";
import { PanelComponent } from "../deeplink-resolver/panel.component";
import { ChecklistEntry } from "../checklist-entry/checklist-entry";
import { MatList } from "@angular/material/list";
import { MatAccordion } from "@angular/material/expansion";
import { JsonPipe } from "@angular/common";
import { MatFormField, MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { CredentialService } from "@services/credential.service";
import { MatButton } from "@angular/material/button";
import { DeeplinkInput } from "../deeplink-input/deeplink-input";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";
import { HolderKeyService } from "@services/holder-key.service";
import { NonceResponse, OAuthToken } from "src/generated/issuer";

@Component({
  selector: "app-credential-issuance-v2",
  imports: [
    MatCard,
    MatCardTitle,
    MatCardContent,
    Credential,
    PanelComponent,
    ChecklistEntry,
    JsonPipe,
    MatList,
    MatAccordion,
    MatFormField,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButton,
    DeeplinkInput,
  ],
  templateUrl: "./credential-issuance-v2.html",
  standalone: true,
})
export class CredentialIssuanceV2 {
  private apiService = inject(ApiService);
  private credentialService = inject(CredentialService);
  private holderKeyService = inject(HolderKeyService);
  readonly panelOpenState = signal(false);
  public input =
    "swiyu://?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%225c2ce09c-44ac-45a1-9d25-d066dd8ad277%22%7D%7D%2C%22version%22%3A%221.0%22%2C%22credential_issuer%22%3A%22https%3A%2F%2Fbcs.admin.ch%2Fbcs-web%2Fissuer-agent%2Foid4vci%22%2C%22credential_configuration_ids%22%3A%5B%22betaid-sdjwt%22%5D%7D";
  deeplink: WritableSignal<undefined | any> = signal(undefined);
  metadata: WritableSignal<undefined | any> = signal(undefined);
  credentialConfig: WritableSignal<undefined | any> = signal(undefined);
  openIdConfig: WritableSignal<undefined | any> = signal(undefined);
  tokenResponse: WritableSignal<OAuthToken | undefined> = signal(undefined);
  nonceResponse: WritableSignal<NonceResponse | undefined> = signal(undefined);
  encodedCredential: WritableSignal<undefined | any> = signal(undefined);
  decodedPayload: WritableSignal<undefined | any> = signal(undefined);
  decodedHeader: WritableSignal<undefined | any> = signal(undefined);
  registryEntry: WritableSignal<undefined | any[]> = signal(undefined);

  public onResolve(input: string): void {
    this.reset();

    const decodedDeeplink: any = this.credentialService.decodeDeeplink(input);
    this.deeplink.set(decodedDeeplink);

    this.apiService
      .resolveOpenIdMetadataFromDeeplink(decodedDeeplink?.credential_issuer)
      .pipe(
        switchMap((metadata) => {

          console.log("Any C : ", typeof(metadata));
          if (metadata) {
            this.metadata.set(metadata);
            this.extractCredentialConfigurationsSupported(
              decodedDeeplink,
              metadata
            );
            return this.apiService.resolveOpenIdConfigMetadataFromDeeplink(
              decodedDeeplink?.credential_issuer
            );
          } else {
            return of(null);
          }
        }),
        switchMap((openIdConfig: any) => {
          this.openIdConfig.set(openIdConfig);
          return this.apiService.getAccessToken(
            decodedDeeplink?.grants?.[
              "urn:ietf:params:oauth:grant-type:pre-authorized_code"
            ]?.["pre-authorized_code"],
            openIdConfig?.token_endpoint
          );
        }),
        switchMap((accessToken: OAuthToken) => {
          this.tokenResponse.set(accessToken);

          return from(
            this.apiService.getNonce(this.metadata()?.["nonce_endpoint"])
          );
        }),
        switchMap((nonce: NonceResponse) => {
          this.nonceResponse.set(nonce);

          return from(this.getCredentialRequestV2(nonce?.c_nonce));
        }),
        switchMap((request: any) => {
          return this.apiService.getCredentialV2(
            this.metadata()?.["credential_endpoint"],
            this.tokenResponse()?.access_token,
            request
          );
        }),
        switchMap((credentialResponse: any) => {
          const credential = credentialResponse?.credentials?.[0]?.credential;
          const token = credential.split("~")[0];
          const decoded = jose.decodeJwt(token);
          this.encodedCredential.set(credential);
          console.log("decoded", decoded);
          return this.apiService.getRegistryEntry(decoded.iss);
        }),
        switchMap((registryEntry: any) => {
          const jwt = this.encodedCredential().split("~")[0];
          console.log("registryEntry", registryEntry);
          this.registryEntry.set(registryEntry);
          return of(
            this.credentialService.decodeResponse(
              jwt,
              this.registryEntry()
            )
          );
        }),
        switchMap((payload: Promise<any>) => {
          payload.then((payload) => {
            this.decodedHeader.set(payload.protectedHeader);
            this.decodedPayload.set(payload.payload);
          });
          return of(payload);
        })
      )
      .subscribe((credential) => {
        console.log("credential", credential);
      });
  }

  public reset(): void {
    this.deeplink.set(undefined);
    this.metadata.set(undefined);
    this.credentialConfig.set(undefined);
    this.openIdConfig.set(undefined);
    this.tokenResponse.set(undefined);
    this.nonceResponse.set(undefined);
    this.encodedCredential.set(undefined);
    this.decodedPayload.set(undefined);
    this.decodedHeader.set(undefined);
  }

  checkIfKeyPresent(): boolean {
    if (!this.registryEntry()) {
      return false;
    }

    const verificationMethods: any[] =
      this.registryEntry()[3]?.value?.verificationMethod;

    if (!verificationMethods || verificationMethods.length === 0) {
      return false;
    }

    const kid = this.decodedHeader()?.kid;

    return verificationMethods.some((method) => method.id === kid);
  }

  private extractCredentialConfigurationsSupported(
    decodedDeeplink: any,
    metadata: any
  ): any {
    this.credentialConfig.set(
      metadata?.credential_configurations_supported?.[
        decodedDeeplink?.credential_configuration_ids?.[0]
      ]
    );
  }

  private async getCredentialRequestV2(nonce: string): Promise<any> {
    const proofSigningAlgValuesSupported =
      this.credentialConfig()?.proof_types_supported?.jwt
        ?.proof_signing_alg_values_supported[0];

    const jwt = await this.credentialService.createHolderBinding(
      this.metadata()?.credential_issuer,
      nonce,
      proofSigningAlgValuesSupported,
      this.holderKeyService.getPrivateKey(),
      this.holderKeyService.getJwk()
    );

    return {
      credential_configuration_id:
        this.deeplink()?.credential_configuration_ids?.[0],
      proofs: {
        jwt: [jwt],
      },
    };
  }
}
