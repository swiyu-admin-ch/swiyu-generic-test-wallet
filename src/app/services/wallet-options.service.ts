import { Injectable } from '@angular/core';
import { WritableSignal, signal } from '@angular/core';

export interface WalletOptions {
  payloadEncryptionPreference: boolean;
  numberOfProofs: false | number;
  useSignedMetadata: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WalletOptionsService {
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
    this.walletOptions.update(options => ({
      ...options,
      payloadEncryptionPreference: value
    }));
  }

  updateNumberOfProofs(value: false | number): void {
    this.walletOptions.update(options => ({
      ...options,
      numberOfProofs: value
    }));
  }

  updateUseSignedMetadata(value: boolean): void {
    this.walletOptions.update(options => ({
      ...options,
      useSignedMetadata: value
    }));
  }

  resetToDefaults(): void {
    this.walletOptions.set(this.defaultOptions);
  }
}

