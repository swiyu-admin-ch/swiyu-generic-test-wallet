import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SdJwtStoreService {
  private issuanceSdJwt: WritableSignal<string> = signal('');
  private verificationSdJwt: WritableSignal<string> = signal('');

  getIssuanceSdJwt(): WritableSignal<string> {
    return this.issuanceSdJwt;
  }

  setIssuanceSdJwt(jwt: string): void {
    this.issuanceSdJwt.set(jwt);
  }

  getVerificationSdJwt(): WritableSignal<string> {
    return this.verificationSdJwt;
  }

  setVerificationSdJwt(jwt: string): void {
    this.verificationSdJwt.set(jwt);
  }

  clearAll(): void {
    this.issuanceSdJwt.set('');
    this.verificationSdJwt.set('');
  }
}

