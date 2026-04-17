import { Injectable } from '@angular/core';
import * as jose from 'jose';

export interface VcKeyPair {
  vcId: string;
  credentialType: string;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  jwk: jose.JWK;
  createdAt: Date;
  issuerId: string;
}

@Injectable({
  providedIn: 'root'
})
export class VcKeyStoreService {
  private vcKeyPairs = new Map<string, VcKeyPair>();

  async generateKeyPairForVc(
    vcId: string,
    credentialType: string,
    issuerId: string,
    existingKeyPair?: { privateKey: CryptoKey; jwk: any }
  ): Promise<VcKeyPair> {
    let publicKey: CryptoKey;
    let privateKey: CryptoKey;
    let jwk: any;

    if (existingKeyPair) {
      privateKey = existingKeyPair.privateKey;
      jwk = existingKeyPair.jwk;
      publicKey = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
      );
    } else {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        true,
        ['sign', 'verify']
      );
      publicKey = keyPair.publicKey;
      privateKey = keyPair.privateKey;
      jwk = await jose.exportJWK(publicKey);
    }

    const vcKeyPair: VcKeyPair = {
      vcId,
      credentialType,
      publicKey,
      privateKey,
      jwk,
      createdAt: new Date(),
      issuerId
    };

    this.vcKeyPairs.set(vcId, vcKeyPair);
    return vcKeyPair;
  }

  getKeyPairByVcId(vcId: string): VcKeyPair | undefined {
    return this.vcKeyPairs.get(vcId);
  }

  getPrivateKeyByVcId(vcId: string): CryptoKey | null {
    const keyPair = this.vcKeyPairs.get(vcId);
    return keyPair?.privateKey ?? null;
  }

  getPublicKeyByVcId(vcId: string): CryptoKey | null {
    const keyPair = this.vcKeyPairs.get(vcId);
    return keyPair?.publicKey ?? null;
  }

  getJwkByVcId(vcId: string): jose.JWK | null {
    const keyPair = this.vcKeyPairs.get(vcId);
    return keyPair?.jwk ?? null;
  }

  getAllKeyPairs(): VcKeyPair[] {
    return Array.from(this.vcKeyPairs.values());
  }

  deleteKeyPairByVcId(vcId: string): boolean {
    return this.vcKeyPairs.delete(vcId);
  }

  clearAllKeyPairs(): void {
    this.vcKeyPairs.clear();
  }
}

