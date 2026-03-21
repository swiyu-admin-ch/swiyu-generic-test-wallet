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
  private keyGeneratedAt: Date | null = null;
  private currentKeyId: string | null = null;

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
    this.keyGeneratedAt = new Date();

    this.currentKeyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getPrivateKey(): CryptoKey {
    if(this.privateKey) 
      return this.privateKey;
    throw new Error("getPrivateKey");
  }

  getPublicKey(): CryptoKey | null {
    return this.publicKey;
  }

  getJwk(): JWK {
    if (this.jwk)
      return this.jwk;
    throw new Error("getJwk")
  }

  getKeyGeneratedAt(): Date | null {
    return this.keyGeneratedAt;
  }

  getCurrentKeyId(): string | null {
    return this.currentKeyId;
  }

  hasKeys(): boolean {
    return this.privateKey !== null && this.publicKey !== null;
  }
}

