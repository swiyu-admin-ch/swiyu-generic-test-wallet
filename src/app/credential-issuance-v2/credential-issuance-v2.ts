import { Component, signal, WritableSignal } from "@angular/core";
import * as jose from "jose";
import { CompactEncrypt } from "jose";
import { Credential } from "../credential/credential";
import { ApiService } from "../api-service";
import { FormsModule } from "@angular/forms";
import { from, of, switchMap } from "rxjs";
import { PanelComponent } from "../deeplink-resolver/panel.component";
import { ChecklistEntry } from "../checklist-entry/checklist-entry";
import { MatList } from "@angular/material/list";
import { MatAccordion } from "@angular/material/expansion";
import { JsonPipe, CommonModule } from "@angular/common";
import { MatFormField, MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { CredentialService } from "@services/credential.service";
import { MatButton } from "@angular/material/button";
import { DeeplinkInput } from "../deeplink-input/deeplink-input";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";
import { HolderKeyService } from "@services/holder-key.service";

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
    CommonModule,
    MatList,
    MatAccordion,
    MatFormFieldModule,
    FormsModule,
    MatInputModule,
    DeeplinkInput,
  ],
  templateUrl: "./credential-issuance-v2.html",
  standalone: true,
})
export class CredentialIssuanceV2 {
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

  credentialRequestEncryptionRequired: WritableSignal<boolean> = signal(false);
  credentialResponseEncryptionRequired: WritableSignal<boolean> = signal(false);
  credentialResponseEncryptionSupported: WritableSignal<boolean> = signal(false);
  credentialRequestEncryptionAlgorithm: WritableSignal<string | undefined> = signal(undefined);
  credentialRequestEncryptionMethod: WritableSignal<string | undefined> = signal(undefined);
  credentialResponseEncryptionAlgorithm: WritableSignal<string | undefined> = signal(undefined);
  credentialResponseEncryptionMethod: WritableSignal<string | undefined> = signal(undefined);
  ephemeralPublicKey: WritableSignal<any | undefined> = signal(undefined);
  encryptedRequest: WritableSignal<string | undefined> = signal(undefined);
  encryptedResponse: WritableSignal<boolean> = signal(false);
  encryptionError: WritableSignal<string | undefined> = signal(undefined);

  constructor(
    private apiService: ApiService,
    private credentialService: CredentialService,
    private holderKeyService: HolderKeyService
  ) {}

  public onResolve(input: string): void {
    this.reset();

    const decodedDeeplink: any = this.credentialService.decodeDeeplink(input);
    this.deeplink.set(decodedDeeplink);

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
            // Check encryption requirements
            this.checkCredentialRequestEncryption(metadata);
            this.checkCredentialResponseEncryption(metadata);
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
        switchMap((accessToken: any) => {
          this.tokenResponse.set(accessToken);

          return from(
            this.apiService.getNonce(this.metadata()?.["nonce_endpoint"])
          );
        }),
        switchMap((nonce: any) => {
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
    this.credentialRequestEncryptionRequired.set(false);
    this.credentialResponseEncryptionRequired.set(false);
    this.credentialResponseEncryptionSupported.set(false);
    this.credentialRequestEncryptionAlgorithm.set(undefined);
    this.credentialRequestEncryptionMethod.set(undefined);
    this.credentialResponseEncryptionAlgorithm.set(undefined);
    this.credentialResponseEncryptionMethod.set(undefined);
    this.ephemeralPublicKey.set(undefined);
    this.encryptedRequest.set(undefined);
    this.encryptedResponse.set(false);
    this.encryptionError.set(undefined);
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

    let request: any = {
      credential_configuration_id:
        this.deeplink()?.credential_configuration_ids?.[0],
      proofs: {
        jwt: [jwt],
      },
    };

    if (this.credentialResponseEncryptionRequired()) {
      try {
        await this.generateEphemeralEncryptionKey();

        const encMetadata = this.metadata().credential_response_encryption;
        request.credential_response_encryption = {
          alg: encMetadata.alg_values_supported?.[0] || "ECDH-ES",
          enc: encMetadata.enc_values_supported?.[0] || "A128GCM",
          jwk: this.ephemeralPublicKey()
        };
      } catch (error) {
        console.error("Error setting up credential response encryption:", error);
      }
    }

    return request;
  }

  private checkCredentialRequestEncryption(metadata: any): void {
    const credentialRequestEncryption = metadata?.credential_request_encryption;

    if (credentialRequestEncryption) {
      const encryptionRequired = credentialRequestEncryption.encryption_required === true;
      this.credentialRequestEncryptionRequired.set(encryptionRequired);

      if (credentialRequestEncryption.enc_values_supported?.length > 0) {
        this.credentialRequestEncryptionMethod.set(
          credentialRequestEncryption.enc_values_supported[0]
        );
      }

      if (credentialRequestEncryption.alg_values_supported?.length > 0) {
        this.credentialRequestEncryptionAlgorithm.set(
          credentialRequestEncryption.alg_values_supported[0]
        );
      }

      console.log("Credential Request Encryption detected:", {
        required: encryptionRequired,
        algorithms: credentialRequestEncryption.alg_values_supported,
        encMethods: credentialRequestEncryption.enc_values_supported
      });
    }
  }

  private checkCredentialResponseEncryption(metadata: any): void {
    const credentialResponseEncryption = metadata?.credential_response_encryption;

    if (credentialResponseEncryption) {
      this.credentialResponseEncryptionRequired.set(true);

      if (credentialResponseEncryption.alg_values_supported?.length > 0) {
        this.credentialResponseEncryptionAlgorithm.set(
          credentialResponseEncryption.alg_values_supported[0]
        );
      }

      if (credentialResponseEncryption.enc_values_supported?.length > 0) {
        this.credentialResponseEncryptionMethod.set(
          credentialResponseEncryption.enc_values_supported[0]
        );
      }

      this.credentialResponseEncryptionSupported.set(true);

      console.log("Credential Response Encryption detected:", {
        algorithms: credentialResponseEncryption.alg_values_supported,
        encMethods: credentialResponseEncryption.enc_values_supported
      });
    }
  }

  private async generateEphemeralEncryptionKey(): Promise<void> {
    try {
      const { publicKey } = await crypto.subtle.generateKey(
        {
          name: "ECDH",
          namedCurve: "P-256",
        },
        true,
        ["deriveKey"]
      );

      await jose.exportSPKI(publicKey);

      const jwkData = await jose.exportJWK(publicKey);
      this.ephemeralPublicKey.set(jwkData);

      console.log("Ephemeral encryption key generated");
    } catch (error) {
      this.encryptionError.set("Failed to generate ephemeral key: " + (error as Error).message);
      console.error("Error generating ephemeral key:", error);
    }
  }

  public async encryptCredentialRequest(requestPayload: string): Promise<string | null> {
    try {
      if (!this.credentialRequestEncryptionRequired()) {
        console.log("Credential request encryption not required");
        return requestPayload;
      }

      const issuerMetadata = this.metadata();
      const credentialRequestEncryption = issuerMetadata?.credential_request_encryption;

      if (!credentialRequestEncryption?.jwks?.keys || credentialRequestEncryption.jwks.keys.length === 0) {
        this.encryptionError.set("No issuer encryption keys available");
        return null;
      }

      const issuerPublicKey = credentialRequestEncryption.jwks.keys[0];
      const encryptionAlg = issuerPublicKey.alg || "ECDH-ES";
      const encryptionEnc = credentialRequestEncryption.enc_values_supported?.[0] || "A128GCM";

      const publicKey = await jose.importJWK(issuerPublicKey, encryptionAlg);

      const encryptedJwe = await new CompactEncrypt(
        new TextEncoder().encode(requestPayload)
      )
        .setProtectedHeader({
          alg: encryptionAlg,
          enc: encryptionEnc,
          typ: "JWT",
          kid: issuerPublicKey.kid
        })
        .encrypt(publicKey);

      this.encryptedRequest.set(encryptedJwe);
      console.log("Credential request encrypted successfully");

      return encryptedJwe;
    } catch (error) {
      const errorMessage = "Failed to encrypt credential request: " + (error as Error).message;
      this.encryptionError.set(errorMessage);
      console.error("Encryption error:", error);
      return null;
    }
  }

  public async decryptCredentialResponse(responseBody: string): Promise<string | null> {
    try {
      if (!this.credentialResponseEncryptionRequired()) {
        console.log("Response encryption not required, returning as-is");
        return responseBody;
      }

      if (!this.ephemeralPublicKey()) {
        this.encryptionError.set("No ephemeral key available for decryption");
        return null;
      }

      console.log("Response decryption would occur here");
      this.encryptedResponse.set(true);

      return responseBody;
    } catch (error) {
      const errorMessage = "Failed to decrypt credential response: " + (error as Error).message;
      this.encryptionError.set(errorMessage);
      console.error("Decryption error:", error);
      return null;
    }
  }

}
