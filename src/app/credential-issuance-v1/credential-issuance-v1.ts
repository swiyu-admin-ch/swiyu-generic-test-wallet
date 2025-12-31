import { Component, OnInit, signal, WritableSignal } from "@angular/core";
import * as jose from "jose";
import { JWK } from "jose";
import { ApiService } from "../api-service";
import { FormsModule } from "@angular/forms";
import { from, of, switchMap } from "rxjs";
import { Credential } from "../credential/credential";
import { PanelComponent } from "../deeplink-resolver/panel.component";
import { ChecklistEntry } from "../checklist-entry/checklist-entry";
import { MatList } from "@angular/material/list";
import { MatAccordion } from "@angular/material/expansion";
import { JsonPipe } from "@angular/common";
import { MatFormField, MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { CredentialService } from "../creddential.service";
import { MatButton } from "@angular/material/button";
import { DeeplinkInput } from "../deeplink-input/deeplink-input";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";

@Component({
  selector: "app-credential-issuance-v1",
  imports: [
    Credential,
    PanelComponent,
    ChecklistEntry,
    MatList,
    MatAccordion,
    JsonPipe,
    MatFormField,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButton,
    DeeplinkInput,
    MatCard,
    MatCardTitle,
    MatCardContent,
  ],
  templateUrl: "./credential-issuance-v1.html",
  standalone: true,
})
export class CredentialIssuanceV1 implements OnInit {
  readonly panelOpenState = signal(false);
  public input =
    "swiyu://?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%225c2ce09c-44ac-45a1-9d25-d066dd8ad277%22%7D%7D%2C%22version%22%3A%221.0%22%2C%22credential_issuer%22%3A%22https%3A%2F%2Fbcs.admin.ch%2Fbcs-web%2Fissuer-agent%2Foid4vci%22%2C%22credential_configuration_ids%22%3A%5B%22betaid-sdjwt%22%5D%7D";
  deeplink: WritableSignal<undefined | any> = signal(undefined);
  metadata: WritableSignal<undefined | any> = signal(undefined);
  credentialConfig: WritableSignal<undefined | any> = signal(undefined);
  openIdConfig: WritableSignal<undefined | any> = signal(undefined);
  tokenResponse: WritableSignal<undefined | any> = signal(undefined);
  nonceResponse: WritableSignal<undefined | any> = signal(undefined);
  encodedCredential: WritableSignal<undefined | any> = signal(undefined);
  decodedPayload: WritableSignal<undefined | any> = signal(undefined);
  decodedHeader: WritableSignal<undefined | any> = signal(undefined);
  registryEntry: WritableSignal<undefined | any[]> = signal(undefined);

  private privateKey: CryptoKey;
  private jwk: JWK;

  constructor(
    private apiService: ApiService,
    private credentialService: CredentialService
  ) {}

  public onResolve(deeplink: string): void {
    this.reset();

    const decodedDeeplink: any =
      this.credentialService.decodeDeeplink(deeplink);
    this.deeplink.set(decodedDeeplink);

    console.log("decodedDeeplink", decodedDeeplink);

    this.apiService
      .resolveOpenIdMetadataFromDeeplink(decodedDeeplink?.credential_issuer)
      .pipe(
        switchMap((metadata) => {
          if (!!metadata) {
            this.metadata.set(metadata);
            this.extractCredentialConfigurationsSupported(
              decodedDeeplink,
              metadata
            );
            return this.apiService.resolveOpenIdConfigMetadataFromDeeplink(
              decodedDeeplink?.credential_issuer
            );
          } else {
            // Condition not met, return an empty observable
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
        switchMap((accessToken: any) => {
          console.log("accessToken", accessToken);
          this.tokenResponse.set(accessToken);
          this.nonceResponse.set(accessToken?.c_nonce);

          return from(this.getCredentialRequest());
        }),
        switchMap((request: any) => {
          return this.apiService.getCredential(
            this.metadata()?.["credential_endpoint"],
            this.tokenResponse()?.access_token,
            request
          );
        }),
        switchMap((credentialResponse: any) => {
          console.log("credentialResponse", credentialResponse);
          const token = credentialResponse.credential.split("~")[0];
          const decoded = jose.decodeJwt(token);
          this.encodedCredential.set(credentialResponse);
          return this.apiService.getRegistryEntry(decoded.iss);
        }),
        switchMap((registryEntry: any) => {
          this.registryEntry.set(registryEntry);
          return of(registryEntry);
        }),
        switchMap((registryEntry: any) => {
          this.registryEntry.set(registryEntry);
          const jwt = this.encodedCredential().credential.split("~")[0];
          return of(
            this.credentialService.decodeResponse(
              jwt,
              this.registryEntry(),
              this.metadata()?.credential_issuer
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

  public async ngOnInit(): Promise<void> {
    const { privateKey, jwk } =
      await this.credentialService.createKeySet();

    this.privateKey = privateKey;
    this.jwk = jwk;
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

  public checkIfKeyPresent(): boolean {
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

  private async getCredentialRequest(): Promise<any> {
    const proofSigningAlgValuesSupported =
      this.credentialConfig()?.proof_types_supported?.jwt
        ?.proof_signing_alg_values_supported[0];

    const jwt = await this.credentialService.createHolderBinding(
      this.metadata()?.credential_issuer,
      this.nonceResponse(),
      proofSigningAlgValuesSupported,
      this.privateKey,
      this.jwk
    );

    const payload = {
      format: "vc+sd-jwt",
      proof: {
        proof_type: "jwt",
        jwt: jwt,
      },
    };
    console.log("payload", payload);
    return payload;
  }
}
