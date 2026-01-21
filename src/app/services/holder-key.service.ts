import { Injectable } from '@angular/core';
import * as jose from 'jose';
import { JWK } from 'jose';

@Injectable({
  providedIn: 'root'
})
export class HolderKeyService {
  private privateKey: CryptoKey | null = null;
  private publicKey: CryptoKey | null = null;
  private jwk: JWK | null = null;

  async initializeKeys(): Promise<void> {
    const { publicKey, privateKey } = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.jwk = await jose.exportJWK(publicKey);
  }

  getPrivateKey(): CryptoKey | null {
    return this.privateKey;
  }

  getPublicKey(): CryptoKey | null {
    return this.publicKey;
  }

  getJwk(): JWK | null {
    return this.jwk;
  }
}

