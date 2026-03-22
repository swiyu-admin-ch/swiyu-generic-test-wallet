import { Component, inject, signal, WritableSignal } from "@angular/core";
import { Credential } from "@app/components/credential-input/credential-input.component";
import { FormsModule } from "@angular/forms";
import { EMPTY, from, of, switchMap } from "rxjs";
import { ValidationPanelComponent } from "@components/validation-panel/validation-panel.component";
import { ValidationItemComponent } from "@components/validation-item/validation-item.component";
import { MatList } from "@angular/material/list";
import { MatAccordion } from "@angular/material/expansion";
import { JsonPipe, KeyValuePipe } from "@angular/common";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { DeeplinkService } from "@services/deeplink.service";
import { DeeplinkInput } from "../../components/deeplink-input/deeplink-input.component";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";
import { SdJwtStoreService } from "@services/sd-jwt-store.service";
import { CredentialConfiguration, CredentialEndpointResponse, IssuerCredentialRequestEncryption, IssuerCredentialResponseEncryption, NonceResponse, OAuthToken } from "src/generated/issuer";
import { JwtPayload, OpenIdMetadataResponse, RegistryEntry, OpenIdConfigResponse } from "@app/models/api-response";
import { DataViewerComponent } from "@app/components/data-viewer/data-viewer.component";
import { HolderKeysCardComponent } from "@components/holder/holder.component";
import { catchError, tap } from 'rxjs/operators';
import { OIDVCIService } from "@app/services/oidvci-service";
import { CredentialOffer } from "@app/models/credential-offer";
import { CryptoService } from "@app/services/crypto-service";
import { ErrorFormatterService } from "@app/services/error-formatter-service";
import { WalletService } from "@app/services/wallet-service";
import { ApiService } from "@app/services/api-service";

@Component({
  selector: "app-credential-issuance",
  imports: [
    MatCard,
    MatCardTitle,
    MatCardContent,
    Credential,
    ValidationPanelComponent,
    ValidationItemComponent,
    JsonPipe,
    MatList,
    MatAccordion,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    DeeplinkInput,
    HolderKeysCardComponent,
    DataViewerComponent,
    KeyValuePipe,
  ],
  templateUrl: "./credential-issuance.html",
  standalone: true,
})
export class CredentialIssuance {
  private oidvciService = inject(OIDVCIService);
  private cryptoService = inject(CryptoService);
  private deeplinkService = inject(DeeplinkService);
  private walletService = inject(WalletService);
  private apiService = inject(ApiService);
  private sdJwtStore = inject(SdJwtStoreService);
  private errorFormatter = inject(ErrorFormatterService);

  sdJwt = this.sdJwtStore.getIssuanceSdJwt();

  displayCorsRecommendation = signal(false);

  readonly panelOpenState = signal(false);
  public input =
  "swiyu://?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%225c2ce09c-44ac-45a1-9d25-d066dd8ad277%22%7D%7D%2C%22version%22%3A%221.0%22%2C%22credential_issuer%22%3A%22https%3A%2F%2Fbcs.admin.ch%2Fbcs-web%2Fissuer-agent%2Foid4vci%22%2C%22credential_configuration_ids%22%3A%5B%22betaid-sdjwt%22%5D%7D";
  
  credentialOffer: WritableSignal<CredentialOffer | undefined> = signal(undefined);
  credentialOfferError = signal<Record<string, any> | string | undefined>(undefined);

  issuerMetadataResponse: WritableSignal<OpenIdMetadataResponse | string | undefined> = signal(undefined);
  issuerMetadata: WritableSignal<OpenIdMetadataResponse | undefined> = signal(undefined);
  issuerMetadataError = signal<Record<string, any> | string | undefined>(undefined);

  credentialConfigurationsSupported: WritableSignal<Record<string, CredentialConfiguration> | undefined> = signal(undefined);
  
  openIdConfigurationResponse: WritableSignal<OpenIdConfigResponse | string | undefined> = signal(undefined);
  openIdConfiguration: WritableSignal<OpenIdConfigResponse | undefined> = signal(undefined);
  openIdConfigurationError = signal<Record<string, any> | string | undefined>(undefined);
  
  credentialResponse: WritableSignal<CredentialEndpointResponse | string | undefined> = signal(undefined);
  credential: WritableSignal<CredentialEndpointResponse | undefined> = signal(undefined);
  credentialError = signal<Record<string, any> | string | undefined>(undefined);

  oAuthToken: WritableSignal<OAuthToken | undefined> = signal(undefined);
  oAuthTokenError = signal<Record<string, any> | string | undefined>(undefined);

  nonce: WritableSignal<NonceResponse | undefined> = signal(undefined);
  nonceError = signal<Record<string, any> | string | undefined>(undefined);

  registryEntry: WritableSignal<RegistryEntry[] | undefined> = signal(undefined);
  registryEntryError = signal<Record<string, any> | string | undefined>(undefined);

  decodedPayload: WritableSignal<JwtPayload | undefined> = signal(undefined);
  decodedHeader: WritableSignal<JwtPayload | undefined> = signal(undefined);
  decodedHeaderError = signal<Record<string, any> | string | undefined>(undefined);

  credentialConfig: WritableSignal<Record<string, unknown> | undefined> = signal(undefined);
  openIdConfig: WritableSignal<Record<string, unknown> | undefined> = signal(undefined);
  tokenResponse: WritableSignal<OAuthToken | undefined> = signal(undefined);
  nonceResponse: WritableSignal<NonceResponse | undefined> = signal(undefined);
  credentialsResponse: WritableSignal<any | undefined> = signal(undefined);
  encodedCredential: WritableSignal<string | undefined> = signal(undefined);
  

  credentialRequestEncryption: WritableSignal<IssuerCredentialRequestEncryption | undefined> = signal(undefined);
  credentialResponseEncryption: WritableSignal<IssuerCredentialResponseEncryption | undefined> = signal(undefined);

  openidError = signal<Record<string, any> | string | undefined>(undefined);
  tokenError = signal<Record<string, any> | string | undefined>(undefined);
  
  public onClear(): void {
    this.reset();
  }

  public onResolve(input: string): void {
    this.reset();

    from([input])
      .pipe(
        tap((deeplink: string) => {
          const credentialOffer: CredentialOffer = this.deeplinkService.decodeSwiyuDeeplink(deeplink);
          this.credentialOffer.set(credentialOffer);
          return of(null);
        }),
        catchError((error) => {
          this.credentialOfferError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => {
          const credentialIssuerUrl = this.credentialOffer()?.credential_issuer;
          if (!credentialIssuerUrl) {
            throw new Error("Missing credential_issuer");
          }
          const signed = this.walletService.getOptions().useSignedMetadata;

          return this.oidvciService.fetchIssuerMetadata(
            credentialIssuerUrl,
            signed
          );
        }),
        tap((issuerMetadataResponse: OpenIdMetadataResponse | string) => {
          this.issuerMetadataResponse.set(issuerMetadataResponse);
          const issuerMetadata: OpenIdMetadataResponse = this.cryptoService.decodeIfJwt<OpenIdMetadataResponse>(issuerMetadataResponse)
          this.issuerMetadata.set(issuerMetadata);
          this.credentialConfigurationsSupported.set(issuerMetadata.credential_configurations_supported);
          this.credentialRequestEncryption.set(issuerMetadata.credential_request_encryption);
          this.credentialResponseEncryption.set(issuerMetadata.credential_response_encryption);
        }),
        catchError((error) => {
          console.error(error);
          if (this.apiService.isLikelyCorsError(error)) {
            this.issuerMetadataError.set(this.errorFormatter.CORS_ERROR_MESSAGE);
          } else {
            this.issuerMetadataError.set(this.errorFormatter.format(error));
          }
          return EMPTY;
        }),
        switchMap(() => {
          const credentialIssuerUrl = this.issuerMetadata()?.credential_issuer;
          if (!credentialIssuerUrl) {
            throw new Error("Missing credential_issuer");
          }
          const signed = this.walletService.getOptions().useSignedMetadata;

          return this.oidvciService.fetchOpenIdConfiguration(
            credentialIssuerUrl,
            signed
          );
        }),
        tap((openIdConfigurationResponse: OpenIdConfigResponse | string) => {
          this.openIdConfigurationResponse.set(openIdConfigurationResponse);
          const openIdConfiguration: OpenIdMetadataResponse = this.cryptoService.decodeIfJwt<OpenIdMetadataResponse>(openIdConfigurationResponse)
          this.openIdConfiguration.set(openIdConfiguration);
        }),
        catchError((error) => {
          console.error(error);
          this.openIdConfigurationError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => {
          const tokenEndpointUrl = this.openIdConfiguration()?.["token_endpoint"] as string;
          const preAuthCode = this.credentialOffer()?.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.['pre-authorized_code'] as string;

          if (!tokenEndpointUrl) {
            throw new Error("Missing tokenEndpointUrl");
          }

          if (!preAuthCode) {
            throw new Error("Missing preAuthCode");
          }

          return this.oidvciService.fetchAccessToken(
            tokenEndpointUrl,
            preAuthCode
          );
        }),
        tap((oAuthToken: OAuthToken) => {
          this.oAuthToken.set(oAuthToken);
        }),
        catchError((error) => {
          console.error(error);
          this.oAuthTokenError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => {
          const nonceEndpointUrl = this.issuerMetadata()?.["nonce_endpoint"] as string;

          if (!nonceEndpointUrl) {
            throw new Error("Missing nonceEndpointUrl");
          }

          return this.oidvciService.fetchNonce(
            nonceEndpointUrl
          );
        }),
        tap((nonce: NonceResponse) => {
          this.nonce.set(nonce);
        }),
        catchError((error) => {
          console.error(error);
          this.nonceError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => {
          const nonceEndpointUrl = this.issuerMetadata()?.["nonce_endpoint"] as string;

          if (!nonceEndpointUrl) {
            throw new Error("Missing nonceEndpointUrl");
          }

          const issuerMetadata = this.issuerMetadata();
          if (!issuerMetadata) {
            throw new Error("Missing issuer metadata")
          }
          const nonce = this.nonce();
          if (!nonce) {
            throw new Error("Missing nonce")
          }

          return this.walletService.buildRequestCredential(
            issuerMetadata, nonce, 1, this.walletService.getOptions().payloadEncryptionPreference
          );
        }),
        catchError((error) => {
          console.error(error);
          this.nonceError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap((payload: any) => {
          const credentialEndpointUrl = this.issuerMetadata()?.["credential_endpoint"] as string;

          if (!credentialEndpointUrl) {
            throw new Error("Missing credentialEndpointUrl");
          }

          const accessToken = this.oAuthToken()?.["access_token"] as string

          if (!accessToken) {
            throw new Error("Missing accessToken");
          }

          return this.oidvciService.fetchCredential(
            credentialEndpointUrl,
            payload,
            accessToken
          );
        }),
        switchMap((credentialResponse: CredentialEndpointResponse | string) => {
          this.credentialResponse.set(credentialResponse);

          return from(
            this.walletService.resolveResponseCredential(credentialResponse)
          );
        }),
        tap((credential: CredentialEndpointResponse) => {
          this.credential.set(credential);
        }),
        catchError((error) => {
          console.error(error);
          this.credentialError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => {
          const credential = this.credential()?.credentials?.[0]?.credential ?? null;
          if (!credential) {
            throw new Error("Credential is missing");
          }
          const registryEntry = this.walletService.buildRegistryUrl(credential)
          return this.oidvciService.fetchRegistryEntry(registryEntry);
        }),
        tap((registryEntry) => {
          this.registryEntry.set(registryEntry);
        }),
        catchError((error) => {
          console.error(error);
          this.registryEntryError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => {
          const credential = this.credential()?.credentials?.[0]?.credential ?? null;
          if (!credential) {
            throw new Error("Credential is missing")
          }
          const registryEntry = this.registryEntry() as RegistryEntry[]
          const jwt = credential.split("~")[0];
          if (!registryEntry) {
            throw new Error("Missing registryEntry");
          }
          return from(this.walletService.decodeJwt(jwt, registryEntry));
        }),
        tap((decodedPayload) => {
          this.decodedHeader.set((decodedPayload.protectedHeader as JwtPayload));
          this.decodedPayload.set((decodedPayload.payload as JwtPayload));
        })
      )
      .subscribe(() => {
        const credential = this.credential()?.credentials?.[0]?.credential ?? null;
        if (credential) {
          this.encodedCredential.set(credential);
          const decodedPayloadData = this.decodedPayload() as Record<string, unknown>;
          const credentialType = (decodedPayloadData?.["vct"] as string) ||
                                  (this.credentialConfig() as Record<string, unknown>)?.["id"] as string ||
                                  'Credential';
                
          this.walletService.addVC(credentialType, credential);
        }
      });
  }

  public reset(): void {
    this.credentialOffer.set(undefined);
    this.credentialOfferError.set(undefined);
    this.issuerMetadataResponse.set(undefined);
    this.issuerMetadata.set(undefined);
    this.issuerMetadataError.set(undefined);
    this.credentialConfigurationsSupported.set(undefined);
    this.openIdConfigurationResponse.set(undefined);
    this.openIdConfiguration.set(undefined);
    this.openIdConfigurationError.set(undefined);
    this.credentialResponse.set(undefined);
    this.credential.set(undefined);
    this.credentialError.set(undefined);
    this.oAuthToken.set(undefined);
    this.oAuthTokenError.set(undefined);
    this.nonce.set(undefined);
    this.nonceError.set(undefined);
    this.registryEntry.set(undefined);
    this.registryEntryError.set(undefined);
    this.decodedPayload.set(undefined);
    this.decodedHeader.set(undefined);
    this.decodedHeaderError.set(undefined);
    this.credentialConfig.set(undefined);
    this.openIdConfig.set(undefined);
    this.tokenResponse.set(undefined);
    this.nonceResponse.set(undefined);
    this.credentialsResponse.set(undefined);
    this.encodedCredential.set(undefined);
    this.credentialRequestEncryption.set(undefined);
    this.credentialResponseEncryption.set(undefined);
  }

  public checkIfKeyPresent(): boolean {
    if (!this.registryEntry()) {
      return false;
    }

    const verificationMethods: Record<string, unknown>[] =
      ((this.registryEntry()?.[3] as Record<string, unknown>)?.["value"] as Record<string, unknown>)?.["verificationMethod"] as Record<string, unknown>[];

    if (!verificationMethods || verificationMethods.length === 0) {
      return false;
    }

    const kid = (this.decodedHeader() as JwtPayload)?.["kid"];

    return verificationMethods.some((method) => (method as Record<string, unknown>)["id"] === kid);
  }
}
