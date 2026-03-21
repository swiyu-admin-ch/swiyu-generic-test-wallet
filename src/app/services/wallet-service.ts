import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { CredentialService } from './credential.service';
import { HolderKeyService } from './holder-key.service';
import { CryptoService } from './crypto-service';
import { JwtPayload, OpenIdMetadataResponse, RegistryEntry } from '@app/models/api-response';
import * as jose from "jose";
import { NonceResponse } from 'src/generated/issuer';
import { WalletOptions } from '@app/models/wallet-options';
import { VCRecord } from '@app/models/vc-record';


@Injectable({
  providedIn: 'root',
})
export class WalletService {
  private credentialService = inject(CredentialService);
  private holderKeyService = inject(HolderKeyService);
  private cryptoService = inject(CryptoService);
  private requestedVCs: WritableSignal<VCRecord[]> = signal([]);

  private readonly STORAGE_KEY = 'wallet_options';
  private readonly defaultOptions: WalletOptions = {
    payloadEncryptionPreference: false,
    numberOfProofs: false,
    useSignedMetadata: false
  };

  private walletOptions: WritableSignal<WalletOptions> = signal(this.loadOptions());

  constructor() {
    this.initializeOptions();
  }

  private loadOptions(): WalletOptions {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as WalletOptions;
      }
    } catch (error) {
      console.error('Failed to load wallet options from localStorage', error);
    }
    return this.defaultOptions;
  }

  private saveOptions(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.walletOptions()));
    } catch (error) {
      console.error('Failed to save wallet options to localStorage', error);
    }
  }

  private initializeOptions(): void {
    this.walletOptions.set(this.loadOptions());
  }

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
    this.saveOptions();
  }

  updateNumberOfProofs(value: false | number): void {
    this.walletOptions.update((options: any) => ({
      ...options,
      numberOfProofs: value
    }));
    this.saveOptions();
  }

  updateUseSignedMetadata(value: boolean): void {
    this.walletOptions.update((options: any) => ({
      ...options,
      useSignedMetadata: value
    }));
    this.saveOptions();
  }

  resetToDefaults(): void {
    this.walletOptions.set(this.defaultOptions);
    this.saveOptions();
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

  buildRegistryUrl(credential: string): string {
    if (!credential) {
      throw new Error("Missing credential in credential response");
    }
    const token = credential.split("~")[0];
    if (!token) {
      throw new Error("Missing token");
    }
    const decoded = jose.decodeJwt(token) as JwtPayload;
    const did = decoded['iss'] as string
    if (!did) {
      throw new Error("Cannot find the iss");
    }
    const parts = did.split(":");
    return `https://${decodeURIComponent(did.substring(did.indexOf(parts[3]), did.length).replace(/:/g, "/"))}/did.jsonl`
  }

  public async decodeJwt(jwt: string, registryEntry: RegistryEntry[]): Promise<{ payload: JwtPayload, protectedHeader: JwtPayload, }> {
      const kid = (jose.decodeProtectedHeader(jwt) as JwtPayload)['kid'];
      const verificationMethods = (registryEntry[3] as Record<string, unknown>)?.['value'] as Record<string, unknown>;
      const verificationMethod = ((verificationMethods?.['verificationMethod'] as Record<string, unknown>[]) || [])
          .map(meth => (meth as Record<string, unknown>)['id'] === kid ? meth : null)
          .filter((meth: Record<string, unknown> | null): meth is Record<string, unknown> => meth != null)[0];
      const jwk = verificationMethod?.['publicKeyJwk'] as CryptoKey;
      const {payload, protectedHeader} = await jose.jwtVerify(jwt, jwk, {})
      return {payload: payload as JwtPayload, protectedHeader: protectedHeader as JwtPayload};
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
      }

      const requestEnc = metadata.credential_request_encryption
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

  async buildHolderBinding(
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

  async resolveResponseCredential(encryptedResponse: string) {
    const privateKey = this.getEphemeralPrivateKey();

    if (!privateKey) {
      throw new Error('Missing wallet ephemeral private key');
    }

    return this.cryptoService.decryptPayload(encryptedResponse, privateKey);
  }

  getRequestedVCs(): WritableSignal<VCRecord[]> {
    return this.requestedVCs;
  }

  addVC(credentialType: string, sdJwt: string): void {
    const newVC: VCRecord = {
      id: `vc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      credentialType,
      issuedAt: new Date(),
      sdJwt
    };

    this.requestedVCs.update(vcs => [...vcs, newVC]);
  }

  removeVC(id: string): void {
    this.requestedVCs.update(vcs => vcs.filter(vc => vc.id !== id));
  }

  clearAll(): void {
    this.requestedVCs.set([]);
  }

  getVCCount(): number {
    return this.requestedVCs().length;
  }

}
