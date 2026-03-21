import { Component, inject, signal, WritableSignal } from "@angular/core";
import { Credential } from "../credential/credential";
import { FormsModule } from "@angular/forms";
import { EMPTY, from, of, switchMap } from "rxjs";
import { PanelComponent } from "../deeplink-resolver/panel.component";
import { ChecklistEntry } from "../checklist-entry/checklist-entry";
import { MatList } from "@angular/material/list";
import { MatAccordion } from "@angular/material/expansion";
import { JsonPipe, KeyValuePipe } from "@angular/common";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { DeeplinkService } from "@services/deeplink.service";
import { DeeplinkInput } from "../deeplink-input/deeplink-input";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";
import { SdJwtStoreService } from "@services/sd-jwt-store.service";
import { MetadataSignatureTrackingService } from "@services/metadata-signature-tracking.service";
import { IssuerCredentialRequestEncryption, IssuerCredentialResponseEncryption, NonceResponse, OAuthToken } from "src/generated/issuer";
import { JwtPayload, OpenIdMetadataResponse, RegistryEntry, OpenIdConfigResponse } from "@app/models/api-response";
import { JsonViewer } from "@components/json-viewer/json-viewer";
import { HolderKeysCardComponent } from "../components/holder-keys-card/holder-keys-card.component";
import { catchError, tap } from 'rxjs/operators';
import { OIDVCIService } from "@app/services/oidvci-service";
import { CredentialOffer } from "@app/models/credential-offer";
import { CryptoService } from "@app/services/crypto-service";
import { ErrorFormatterService } from "@app/services/error-formatter-service";
import { WalletService } from "@app/services/wallet-service";

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
    KeyValuePipe,
  ],
  templateUrl: "./credential-issuance.html",
  standalone: true,
})
export class CredentialIssuance {
  private oidvciService = inject(OIDVCIService);
  private cryptoService = inject(CryptoService);
  private deeplinkService = inject(DeeplinkService);
  private metadataSignatureTrackingService = inject(MetadataSignatureTrackingService);
  private walletService = inject(WalletService);
  private sdJwtStore = inject(SdJwtStoreService);
  private errorFormatter = inject(ErrorFormatterService);

  sdJwt = this.sdJwtStore.getIssuanceSdJwt();

  readonly panelOpenState = signal(false);
  public input =
  "swiyu://?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%225c2ce09c-44ac-45a1-9d25-d066dd8ad277%22%7D%7D%2C%22version%22%3A%221.0%22%2C%22credential_issuer%22%3A%22https%3A%2F%2Fbcs.admin.ch%2Fbcs-web%2Fissuer-agent%2Foid4vci%22%2C%22credential_configuration_ids%22%3A%5B%22betaid-sdjwt%22%5D%7D";
  
  credentialOffer: WritableSignal<CredentialOffer | undefined> = signal(undefined);
  credentialOfferError = signal<Record<string, any> | string | undefined>(undefined);

  issuerMetadataResponse: WritableSignal<OpenIdMetadataResponse | string | undefined> = signal(undefined);
  issuerMetadata: WritableSignal<OpenIdMetadataResponse | undefined> = signal(undefined);
  issuerMetadataError = signal<Record<string, any> | string | undefined>(undefined);

  credentialConfigurationsSupported: WritableSignal<Record<string, unknown> | undefined> = signal(undefined);
  
  openIdConfigurationResponse: WritableSignal<OpenIdConfigResponse | string | undefined> = signal(undefined);
  openIdConfiguration: WritableSignal<OpenIdConfigResponse | undefined> = signal(undefined);
  openIdConfigurationError = signal<Record<string, any> | string | undefined>(undefined);

  
  credentialResponse: WritableSignal<any | string | undefined> = signal(undefined);
  credential: WritableSignal<any | undefined> = signal(undefined);
  credentialError = signal<Record<string, any> | string | undefined>(undefined);

  oAuthToken: WritableSignal<OAuthToken | undefined> = signal(undefined);
  oAuthTokenError = signal<Record<string, any> | string | undefined>(undefined);

  nonce: WritableSignal<NonceResponse | undefined> = signal(undefined);
  nonceError = signal<Record<string, any> | string | undefined>(undefined);


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

  openidError = signal<Record<string, any> | string | undefined>(undefined);
  tokenError = signal<Record<string, any> | string | undefined>(undefined);

  openIdMetadataIsSigned = this.metadataSignatureTrackingService.getOpenIdMetadataIsSigned();
  openIdConfigMetadataIsSigned = this.metadataSignatureTrackingService.getOpenIdConfigMetadataIsSigned();
  
  

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
          console.error(error);
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

          console.log(this.credentialConfigurationsSupported())
        }),
        catchError((error) => {
          console.error(error);
          this.issuerMetadataError.set(this.errorFormatter.format(error));
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

          console.log("B", this.walletService.getOptions().payloadEncryptionPreference)

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
        tap((credentialResponse: any) => {
          this.credentialResponse.set(credentialResponse);
          const credential: any = credentialResponse //this.cryptoService.decodeIfJwt<OpenIdMetadataResponse>(credentialResponse)
          this.credential.set(credential);
        }),
        catchError((error) => {
          console.error(error);
          this.credentialError.set(this.errorFormatter.format(error));
          return EMPTY;
        }),
        switchMap(() => {
          return this.oidvciService.fetchRegistryEntry(
            "",
          );
        }),
      )
      .subscribe(() => {
        // this.vcStoreService.addVC(credentialType, this.encodedCredential() || '');
        console.log("DONE")
      });
    //             switchMap((nonce: NonceResponse) => {
    //               this.nonceResponse.set(nonce);
    //               return from(this.getCredentialRequestV2((this.metadata() as OpenIdMetadataResponse), nonce?.c_nonce));
    //             }),
    //             switchMap((request: Record<string, unknown>) =>
    //               this.apiService.getCredentialV2(
    //                 this.metadata(),
    //                 (this.tokenResponse() as OAuthToken)?.access_token,
    //                 request as CredentialResponse
    //               )
    //             ),
    //             catchError((error) => {
    //               this.credentialError.set(
    //                 error ?? "Failed to get credential"
    //               );
    //               return EMPTY;
    //             }),
    //             switchMap((credentialResponse: any) => {
    //               this.credentialsResponse.set(credentialResponse);
    //               return from(
    //                 this.apiService.processCredentialResponse(
    //                   credentialResponse,
    //                   this.metadata()?.credential_response_encryption,
    //                   this.metadata()?.credential_response_encryption?.encryption_required
    //                 )
    //               )
    //             }),
    //             switchMap((credentialResponse: CredentialResponse) => {
    //               const credential = ((credentialResponse?.credentials as Record<string, unknown>[])?.[0] as Record<string, unknown>)?.credential as string;
    //               const token = credential.split("~")[0];
    //               const decoded = jose.decodeJwt(token) as JwtPayload;
    //               this.encodedCredential.set(credential);
    //               return this.apiService.getRegistryEntry(decoded.iss as string);
    //             }),
    //             switchMap((registryEntry: RegistryEntry[]) => {
    //               const jwt = (this.encodedCredential() as string).split("~")[0];
    //               this.registryEntry.set(registryEntry);
    //               return of(
    //                 this.credentialService.decodeResponse(
    //                   jwt,
    //                   this.registryEntry() as RegistryEntry[]
    //                 )
    //               );
    //             }),
    //             switchMap((payload: Promise<Record<string, unknown>>) => {
    //               return from(payload).pipe(
    //                 tap((decodedPayload) => {
    //                   this.decodedHeader.set((decodedPayload.protectedHeader as JwtPayload));
    //                   this.decodedPayload.set((decodedPayload.payload as JwtPayload));
    //                 })
    //               );
    //             })
    //           );
    //         })
    //       );
    //   })
    // )
    // .subscribe((decodedPayload) => {
    //   console.log("credential decoded", decodedPayload);

    //   if (this.encodedCredential()) {
    //     const decodedPayloadData = this.decodedPayload() as Record<string, unknown>;
    //     const credentialType = (decodedPayloadData?.vct as string) ||
    //                            (this.credentialConfig() as Record<string, unknown>)?.id as string ||
    //                            'Credential';
    //     this.vcStoreService.addVC(credentialType, this.encodedCredential() || '');
    //   }
    // });
  }

  public reset(): void {
    this.credentialOffer.set(undefined);
    this.credentialOfferError.set(undefined);

    this.issuerMetadata.set(undefined);
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
    this.credentialsResponse.set(undefined);
    this.tokenError.set(undefined);
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
