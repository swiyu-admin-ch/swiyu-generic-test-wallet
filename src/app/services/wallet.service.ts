import { Injectable, signal, WritableSignal } from '@angular/core';
import { JWK } from 'jose';

export interface MockCredential {
  credential: string;
  format: string;
  decodedPayload: any;
  decodedHeader: any;
  registryEntry?: any[];
  issuedAt: Date;
  privateKey?: CryptoKey;
  jwk?: JWK;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {

  private mockCredentials: WritableSignal<MockCredential[]> = signal([]);

  constructor() {}

  public storeCredential(
    credential: string,
    format: string,
    decodedPayload: any,
    decodedHeader: any,
    registryEntry?: any[],
    privateKey?: CryptoKey,
    jwk?: JWK
  ): void {
    const mockCredential: MockCredential = {
      credential,
      format,
      decodedPayload,
      decodedHeader,
      registryEntry,
      issuedAt: new Date(),
      privateKey,
      jwk
    };

    const currentCredentials = this.mockCredentials();
    this.mockCredentials.set([...currentCredentials, mockCredential]);
  }

  public getCredentials(): WritableSignal<MockCredential[]> {
    return this.mockCredentials;
  }

  public getFirstCredential(): MockCredential | null {
    const credentials = this.mockCredentials();
    return credentials.length > 0 ? credentials[0] : null;
  }

  public clearCredentials(): void {
    this.mockCredentials.set([]);
  }
}

