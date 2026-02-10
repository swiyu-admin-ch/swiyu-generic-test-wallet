import { Component, inject, signal, WritableSignal } from "@angular/core";
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
import { CredentialService } from "@services/credential.service";
import { MatButton } from "@angular/material/button";
import { DeeplinkInput } from "../deeplink-input/deeplink-input";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";
import { HolderKeyService } from "@services/holder-key.service";
import { OAuthToken } from "src/generated/issuer";
import { JwtPayload, OpenIdMetadataResponse, CredentialResponse, RegistryEntry } from "@app/models/api-response";

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
export class CredentialIssuanceV1 {
  private apiService = inject(ApiService);
  private credentialService = inject(CredentialService);
  private holderKeyService = inject(HolderKeyService);

  readonly panelOpenState = signal(false);
  public input =
    "swiyu://?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%225c2ce09c-44ac-45a1-9d25-d066dd8ad277%22%7D%7D%2C%22version%22%3A%221.0%22%2C%22credential_issuer%22%3A%22https%3A%2F%2Fbcs.admin.ch%2Fbcs-web%2Fissuer-agent%2Foid4vci%22%2C%22credential_configuration_ids%22%3A%5B%22betaid-sdjwt%22%5D%7D";
  deeplink: WritableSignal<Record<string, unknown> | undefined> = signal(undefined);
  metadata: WritableSignal<OpenIdMetadataResponse | undefined> = signal(undefined);
  credentialConfig: WritableSignal<Record<string, unknown> | undefined> = signal(undefined);
  openIdConfig: WritableSignal<Record<string, unknown> | undefined> = signal(undefined);
  tokenResponse: WritableSignal<OAuthToken | undefined> = signal(undefined);
  nonceResponse: WritableSignal<string | undefined> = signal(undefined);
  encodedCredential: WritableSignal<CredentialResponse | undefined> = signal(undefined);
  decodedPayload: WritableSignal<JwtPayload | undefined> = signal(undefined);
  decodedHeader: WritableSignal<JwtPayload | undefined> = signal(undefined);
  registryEntry: WritableSignal<RegistryEntry[] | undefined> = signal(undefined);

  public onClear(): void {
    this.reset();
  }

  public onResolve(deeplink: string): void {
    this.reset();

    const decodedDeeplink: Record<string, unknown> =
      this.credentialService.decodeDeeplink(deeplink);
    this.deeplink.set(decodedDeeplink);

    this.apiService
      .resolveOpenIdMetadataFromDeeplink(decodedDeeplink?.credential_issuer as string)
      .pipe(
        switchMap((metadata) => {
          if (metadata) {
            this.metadata.set(metadata);
            this.extractCredentialConfigurationsSupported(
              decodedDeeplink,
              metadata
            );
            return this.apiService.resolveOpenIdConfigMetadataFromDeeplink(
              decodedDeeplink?.credential_issuer as string
            );
          } else {
            return of(null);
          }
        }),
        switchMap((openIdConfig: Record<string, unknown> | null) => {
          this.openIdConfig.set(openIdConfig as Record<string, unknown> | undefined);
          return this.apiService.getAccessToken(
            (decodedDeeplink?.grants as Record<string, Record<string, string>>)?.[
              "urn:ietf:params:oauth:grant-type:pre-authorized_code"
            ]?.["pre-authorized_code"],
            (openIdConfig as Record<string, unknown>)?.token_endpoint as string
          );
        }),
        switchMap((accessToken: OAuthToken) => {
          this.tokenResponse.set(accessToken);
          this.nonceResponse.set(accessToken?.c_nonce);

          return from(this.getCredentialRequest());
        }),
        switchMap((request: Record<string, unknown>) => {
          return this.apiService.getCredential(
            (this.metadata() as OpenIdMetadataResponse)?.["credential_endpoint"] as string,
            (this.tokenResponse() as OAuthToken)?.access_token,
            request as CredentialResponse
          );
        }),
        switchMap((credentialResponse: CredentialResponse) => {
          const token = (credentialResponse.credential as string).split("~")[0];
          const decoded = jose.decodeJwt(token) as JwtPayload;
          this.encodedCredential.set(credentialResponse);
          return this.apiService.getRegistryEntry(decoded.iss as string);
        }),
        switchMap((registryEntry: RegistryEntry[]) => {
          this.registryEntry.set(registryEntry);
          return of(registryEntry);
        }),
        switchMap((registryEntry: RegistryEntry[]) => {
          this.registryEntry.set(registryEntry);
          const jwt = ((this.encodedCredential() as CredentialResponse).credential as string).split("~")[0];
          return of(
            this.credentialService.decodeResponse(
              jwt,
              this.registryEntry() as RegistryEntry[]
            )
          );
        }),
        switchMap((payload: Promise<Record<string, unknown>>) => {
          void payload.then((decodedPayload) => {
            this.decodedHeader.set((decodedPayload.protectedHeader as JwtPayload));
            this.decodedPayload.set((decodedPayload.payload as JwtPayload));
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

  public checkIfKeyPresent(): boolean {
    if (!this.registryEntry()) {
      return false;
    }

    const verificationMethods: Record<string, unknown>[] =
      ((this.registryEntry()?.[3] as Record<string, unknown>)?.value as Record<string, unknown>)?.verificationMethod as Record<string, unknown>[];

    if (!verificationMethods || verificationMethods.length === 0) {
      return false;
    }

    const kid = (this.decodedHeader() as JwtPayload)?.kid;

    return verificationMethods.some((method) => (method as Record<string, unknown>).id === kid);
  }

  private extractCredentialConfigurationsSupported(
    decodedDeeplink: Record<string, unknown>,
    metadata: OpenIdMetadataResponse
  ): void {
    this.credentialConfig.set(
      (metadata?.credential_configurations_supported as Record<string, unknown>)?.[
        (decodedDeeplink?.credential_configuration_ids as string[])?.[0]
      ] as Record<string, unknown> | undefined
    );
  }

  private async getCredentialRequest(): Promise<Record<string, unknown>> {
    const proofSigningAlgValuesSupported =
      ((this.credentialConfig() as Record<string, unknown>)?.proof_types_supported as Record<string, Record<string, unknown>>)?.jwt
        ?.proof_signing_alg_values_supported?.[0] as string;

    const jwt = await this.credentialService.createHolderBinding(
      (this.metadata() as OpenIdMetadataResponse)?.credential_issuer as string,
      this.nonceResponse(),
      proofSigningAlgValuesSupported,
      this.holderKeyService.getPrivateKey(),
      this.holderKeyService.getJwk()
    );
    const holderPublicKey = await this.extractPublicKeyFromJwk(this.holderKeyService.getJwk());

    const payload: Record<string, unknown> = {
      format: "vc+sd-jwt",
      proof: {
        proof_type: "jwt",
        jwt: jwt,
      },
      holder_public_key: holderPublicKey,
    };
    return payload;
  }

  private async extractPublicKeyFromJwk(jwk: JWK): Promise<Record<string, unknown>> {
    return {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
      kid: "holder-key-1",
    };
  }
}
