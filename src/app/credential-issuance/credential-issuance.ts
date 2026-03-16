import { Component, inject, signal, WritableSignal } from "@angular/core";
import * as jose from "jose";
import { Credential } from "../credential/credential";
import { ApiService } from "../api-service";
import { FormsModule } from "@angular/forms";
import { EMPTY, from, of, switchMap } from "rxjs";
import { PanelComponent } from "../deeplink-resolver/panel.component";
import { ChecklistEntry } from "../checklist-entry/checklist-entry";
import { MatList } from "@angular/material/list";
import { MatAccordion } from "@angular/material/expansion";
import { JsonPipe } from "@angular/common";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { CredentialService } from "@services/credential.service";
import { DeeplinkInput } from "../deeplink-input/deeplink-input";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";
import { HolderKeyService } from "@services/holder-key.service";
import { SdJwtStoreService } from "@services/sd-jwt-store.service";
import { IssuerCredentialRequestEncryption, IssuerCredentialResponseEncryption, NonceResponse, OAuthToken } from "src/generated/issuer";
import { JwtPayload, OpenIdMetadataResponse, CredentialResponse, RegistryEntry } from "@app/models/api-response";
import { JsonViewer } from "@components/json-viewer/json-viewer";
import { HolderKeysCardComponent } from "../components/holder-keys-card/holder-keys-card.component";
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Component({
  selector: "app-credential-issuance",
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
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    DeeplinkInput,
    HolderKeysCardComponent,
    JsonViewer,
  ],
  templateUrl: "./credential-issuance.html",
  standalone: true,
})
export class CredentialIssuance {
  private apiService = inject(ApiService);
  private credentialService = inject(CredentialService);
  private holderKeyService = inject(HolderKeyService);
  private sdJwtStore = inject(SdJwtStoreService);

  sdJwt = this.sdJwtStore.getIssuanceSdJwt();

  readonly panelOpenState = signal(false);
  public input =
    "swiyu://?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%225c2ce09c-44ac-45a1-9d25-d066dd8ad277%22%7D%7D%2C%22version%22%3A%221.0%22%2C%22credential_issuer%22%3A%22https%3A%2F%2Fbcs.admin.ch%2Fbcs-web%2Fissuer-agent%2Foid4vci%22%2C%22credential_configuration_ids%22%3A%5B%22betaid-sdjwt%22%5D%7D";
  deeplink: WritableSignal<Record<string, unknown> | undefined> = signal(undefined);
  metadata: WritableSignal<OpenIdMetadataResponse | undefined> = signal(undefined);
  credentialConfig: WritableSignal<Record<string, unknown> | undefined> = signal(undefined);
  openIdConfig: WritableSignal<Record<string, unknown> | undefined> = signal(undefined);
  tokenResponse: WritableSignal<OAuthToken | undefined> = signal(undefined);
  nonceResponse: WritableSignal<NonceResponse | undefined> = signal(undefined);
  credentialsResponse: WritableSignal<any | undefined> = signal(undefined);
  encodedCredential: WritableSignal<string | undefined> = signal(undefined);
  decodedPayload: WritableSignal<JwtPayload | undefined> = signal(undefined);
  decodedHeader: WritableSignal<JwtPayload | undefined> = signal(undefined);
  registryEntry: WritableSignal<RegistryEntry[] | undefined> = signal(undefined);

  credentialRequestEncryption: WritableSignal<IssuerCredentialRequestEncryption | undefined> = signal(undefined);
  credentialResponseEncryption: WritableSignal<IssuerCredentialResponseEncryption | undefined> = signal(undefined);

  metadataError = signal<string | undefined>(undefined);
  openidError = signal<string | undefined>(undefined);
  tokenError = signal<string | undefined>(undefined);
  nonceError = signal<string | undefined>(undefined);
  credentialError = signal<string | undefined>(undefined);

  public onClear(): void {
    this.reset();
  }

  public onResolve(input: string): void {
    this.reset();

    const decodedDeeplink: Record<string, unknown> = this.credentialService.decodeDeeplink(input);
    this.deeplink.set(decodedDeeplink);

    this.apiService
      .resolveOpenIdMetadataFromDeeplink(decodedDeeplink?.credential_issuer as string)
      .pipe(
        catchError((error) => {
          this.metadataError.set(
            error?.message ?? "Failed to resolve OpenID metadata"
          );

          return EMPTY;
        }),
        switchMap((metadata) => {
          if (metadata) {
            this.credentialRequestEncryption.set(metadata.credential_request_encryption);
            this.credentialResponseEncryption.set(metadata.credential_response_encryption);
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
        catchError((error) => {
          this.openidError.set(
            error?.message ?? "Failed to resolve OpenID metadata"
          );

          return EMPTY;
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
        catchError((error) => {
          this.tokenError.set(
            error?.message ?? "Failed to retrieve access token"
          );

          return EMPTY;
        }),
        switchMap((accessToken: OAuthToken) => {
          this.tokenResponse.set(accessToken);

          return from(
            this.apiService.getNonce((this.metadata() as OpenIdMetadataResponse)?.["nonce_endpoint"] as string)
          );
        }),
        catchError((error) => {
          this.nonceError.set(
            error?.message ?? "Failed to retrieve nonce"
          );

          return EMPTY;
        }),
        switchMap((nonce: NonceResponse) => {
          this.nonceResponse.set(nonce);
          return from(this.getCredentialRequestV2((this.metadata() as OpenIdMetadataResponse), nonce?.c_nonce));
        }),
        switchMap((request: Record<string, unknown>) => {
          return this.apiService.getCredentialV2(
            this.metadata(),
            (this.tokenResponse() as OAuthToken)?.access_token,
            request as CredentialResponse
          );
        }),
        catchError((error) => {
          this.credentialError.set(
            error ?? "Failed to get credential"
          );

          return EMPTY;
        }),
        switchMap((credentialResponse: any) => {
          this.credentialsResponse.set(credentialResponse);
          return from(
            this.apiService.processCredentialResponse(
              credentialResponse,
              this.metadata()?.credential_response_encryption,
              this.metadata()?.credential_response_encryption?.encryption_required
            )
          )
        }),
        switchMap((credentialResponse: CredentialResponse) => {
          const credential = ((credentialResponse?.credentials as Record<string, unknown>[])?.[0] as Record<string, unknown>)?.credential as string;
          const token = credential.split("~")[0];
          const decoded = jose.decodeJwt(token) as JwtPayload;
          this.encodedCredential.set(credential);
          return this.apiService.getRegistryEntry(decoded.iss as string);
        }),
        switchMap((registryEntry: RegistryEntry[]) => {
          const jwt = (this.encodedCredential() as string).split("~")[0];
          this.registryEntry.set(registryEntry);
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
    this.credentialRequestEncryption.set(undefined);
    this.credentialResponseEncryption.set(undefined);
    this.registryEntry.set(undefined);

    this.tokenError.set(undefined);
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

  private async getCredentialRequestV2(
    metadata: OpenIdMetadataResponse,
    nonce: string
  ): Promise<Record<string, unknown>> {

    const credentialConfigurationId =
      (this.deeplink() as Record<string, unknown>)?.credential_configuration_ids?.[0];

    const proofSigningAlgValuesSupported =
      ((this.credentialConfig() as Record<string, unknown>)?.proof_types_supported as Record<string, any>)?.jwt
        ?.proof_signing_alg_values_supported?.[0];

    const jwt = await this.credentialService.createHolderBinding(
      (this.metadata() as OpenIdMetadataResponse)?.credential_issuer as string,
      nonce,
      proofSigningAlgValuesSupported,
      this.holderKeyService.getPrivateKey(),
      this.holderKeyService.getJwk()
    );

    const format = (
      metadata.credential_configurations_supported[
      credentialConfigurationId
      ] as { format: string }
    ).format;

    return {
      format,
      credential_configuration_id: credentialConfigurationId,
      proofs: {
        proof_type: "jwt",
        jwt: [jwt],
      },
    };
  }
}
