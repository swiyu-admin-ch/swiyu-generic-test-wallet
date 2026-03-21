import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { CredentialService } from './credential.service';
import { HolderKeyService } from './holder-key.service';
import { CryptoService } from './crypto-service';
import { OpenIdMetadataResponse } from '@app/models/api-response';
import * as jose from "jose";
import { NonceResponse } from 'src/generated/issuer';
import { WalletOptions } from '@app/models/wallet-options';


@Injectable({
  providedIn: 'root',
})
export class WalletService {
  private credentialService = inject(CredentialService);
  private holderKeyService = inject(HolderKeyService);
  private cryptoService = inject(CryptoService);

  private defaultOptions: WalletOptions = {
    payloadEncryptionPreference: false,
    numberOfProofs: false, // Use batch size from metadata
    useSignedMetadata: false // Use signed metadata
  };

  private walletOptions: WritableSignal<WalletOptions> = signal(this.defaultOptions);

  getOptions(): WalletOptions {
    return this.walletOptions();
  }

  getOptionsSignal(): WritableSignal<WalletOptions> {
    return this.walletOptions;
  }

  updatePayloadEncryptionPreference(value: boolean): void {
    this.walletOptions.update((options: any) => ({
      ...options,
      payloadEncryptionPreference: value
    }));
  }

  updateNumberOfProofs(value: false | number): void {
    this.walletOptions.update((options: any) => ({
      ...options,
      numberOfProofs: value
    }));
  }

  updateUseSignedMetadata(value: boolean): void {
    this.walletOptions.update((options: any) => ({
      ...options,
      useSignedMetadata: value
    }));
  }

  resetToDefaults(): void {
    this.walletOptions.set(this.defaultOptions);
  }

  private ephemeralPrivateKey?: CryptoKey;

  setEphemeralPrivateKey(key: CryptoKey) {
    this.ephemeralPrivateKey = key;
  }

  getEphemeralPrivateKey(): CryptoKey | undefined {
    return this.ephemeralPrivateKey;
  }

  private getCredentialConfig(metadata: OpenIdMetadataResponse) {
    const entries = Object.entries(metadata.credential_configurations_supported ?? {});

    if (!entries.length) {
      throw new Error('No credential configurations available');
    }

    const [credentialConfigurationId, credentialConfiguration] = entries[0];

    return { 
      credentialConfigurationId: credentialConfigurationId as string, 
      credentialConfiguration: credentialConfiguration as Record<string, any>
    };
  }

  async buildRequestCredential(
    metadata: OpenIdMetadataResponse,
    nonce: NonceResponse,
    proofsSizePreference: number | null = null,
    encryptionPreference: boolean = false,
  ): Promise<any> {

    const buildEncrypted =
      metadata.credential_request_encryption?.encryption_required ||
      encryptionPreference;

    const numberOfProofs =
      proofsSizePreference ??
      metadata.batch_credential_issuance?.batch_size ??
      1;

    const credentialIssuer = metadata.credential_issuer as string;

    if (!credentialIssuer) {
      throw new Error('No credentialIssuer available');
    }

    const { credentialConfigurationId, credentialConfiguration } =
      this.getCredentialConfig(metadata);

    const format = credentialConfiguration?.['format'] as string;

    if (!format) {
      throw new Error('No format available');
    }

    const proofAlg =
      credentialConfiguration?.['proof_types_supported']?.['jwt']?.['proof_signing_alg_values_supported'][0] as string;

    if (!proofAlg) {
      throw new Error('No proof signing algorithm available');
    }

    const proofs = {
      proof_type: 'jwt',
      jwt: [] as string[],
    }

    for (let i = 0; i < numberOfProofs; i++) {
      const jwt = await this.buildHolderBinding(Math.floor(Date.now() / 1000), credentialIssuer, nonce.c_nonce, proofAlg);
      proofs.jwt.push(jwt);
    }

    const payload: any = {
      format,
      credential_configuration_id: credentialConfigurationId,
      proofs,
    };

    if (buildEncrypted) {
      console.log("Building encrypted")
      const encConfig = metadata.credential_response_encryption;

      if (encConfig?.alg_values_supported?.length) {
        const alg = encConfig.alg_values_supported[0];
        const enc = encConfig.enc_values_supported?.[0];

        const keyPair = await this.cryptoService.generateEphemeralKeyPair(alg);
        this.setEphemeralPrivateKey(keyPair.privateKey);

        const publicJwk = await this.cryptoService.exportPublicJwk(keyPair.publicKey);

        payload.credential_response_encryption = {
          alg,
          enc,
          jwk: publicJwk,
        };

        console.log("P", payload)
      }

      const requestEnc = metadata.credential_request_encryption

      console.log(requestEnc)

      const jwk = requestEnc?.jwks?.keys?.[0];
      const alg = jwk?.alg;
      const enc = requestEnc?.enc_values_supported?.[0];
      const zip = requestEnc?.zip_values_supported?.[0]; 

      if (!jwk) {
        throw new Error('No encryption key available in credential_request_encryption.jwks.keys');
      }

      if (!alg) {
        throw new Error('No alg available in credential_request_encryption.jwks.keys');
      }

      if (!enc) {
        throw new Error('No encryption value available in credential_request_encryption.enc_values_supported');
      }

      if (!zip) {
        throw new Error('No encryption value available in credential_request_encryption.zip_values_supported');
      }

      return this.cryptoService.encryptPayload(
        payload,
        jwk,
        alg,
        enc,
        zip,
      );
    }

    return payload;
  }

  public async buildHolderBinding(
    now: number,
    audience: string,
    nonce: string,
    alg: string,
  ): Promise<string> {
    const claims: Record<string, unknown> = {
      "aud": audience,
      "iat": now,
      "nonce": nonce,
    }

    const jwt = await new jose.SignJWT(claims)
      .setProtectedHeader({ alg: alg, typ: 'openid4vci-proof+jwt', jwk: this.holderKeyService.getJwk() })
      .setIssuedAt(now)
      .setAudience(audience)
      .setExpirationTime('2h')
      .sign(this.holderKeyService.getPrivateKey());

    return jwt;
  }

}
