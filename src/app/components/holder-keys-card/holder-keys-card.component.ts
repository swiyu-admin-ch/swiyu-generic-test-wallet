import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { HolderKeyService } from '@services/holder-key.service';
import { WalletOptionsService, WalletOptions } from '@services/wallet-options.service';
import { VcStoreService } from '@services/vc-store.service';
import { WritableSignal, signal } from '@angular/core';

@Component({
  selector: 'app-holder-keys-card',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatCardModule,
    MatSlideToggleModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule
  ],
  templateUrl: './holder-keys-card.component.html'
})
export class HolderKeysCardComponent implements OnInit {
  private holderKeyService = inject(HolderKeyService);
  private walletOptionsService = inject(WalletOptionsService);
  private vcStoreService = inject(VcStoreService);

  holderKeyGeneratedAt: WritableSignal<Date | null> = signal(null);
  isExpanded: WritableSignal<boolean> = signal(true);
  ephemeralKeysUrl = 'https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet?tab=readme-ov-file#ephemeral-holder-keys-and-page-refresh';
  requestedVCs = this.vcStoreService.getRequestedVCs();

  // Wallet Options
  walletOptions: WritableSignal<WalletOptions> = signal({
    payloadEncryptionPreference: false,
    numberOfProofs: false,
    useSignedMetadata: false
  });
  numberOfProofsInput: WritableSignal<string> = signal('');
  useCustomNumberOfProofs: WritableSignal<boolean> = signal(false);
  useSignedMetadata: WritableSignal<boolean> = signal(false);

  ngOnInit(): void {
    this.updateKeyGenerationTime();

    const checkInterval = setInterval(() => {
      const newTime = this.holderKeyService.getKeyGeneratedAt();
      if (newTime && newTime !== this.holderKeyGeneratedAt()) {
        this.holderKeyGeneratedAt.set(newTime);
      }
    }, 1000);

    window.addEventListener('beforeunload', () => clearInterval(checkInterval));
  }

  toggleExpand(): void {
    this.isExpanded.update(value => !value);
  }

  private updateKeyGenerationTime(): void {
    const keyTime = this.holderKeyService.getKeyGeneratedAt();
    if (keyTime) {
      this.holderKeyGeneratedAt.set(keyTime);
    }
  }

  formatDate(date: Date | null): string {
    if (!date) {
      return 'Not initialized';
    }

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };

    try {
      return new Intl.DateTimeFormat(navigator.language, options).format(date);
    } catch (error) {
      return date.toLocaleString();
    }
  }

  getCurrentKeyId(): string {
    return this.holderKeyService.getCurrentKeyId() || 'Not initialized';
  }

  openEphemeralKeysInfo(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    window.open(this.ephemeralKeysUrl, '_blank');
  }

  // Wallet Options Methods
  onPayloadEncryptionChange(value: boolean): void {
    this.walletOptionsService.updatePayloadEncryptionPreference(value);
    this.walletOptions.update(options => ({
      ...options,
      payloadEncryptionPreference: value
    }));
  }

  onNumberOfProofsToggle(useCustom: boolean): void {
    this.useCustomNumberOfProofs.set(useCustom);
    if (!useCustom) {
      this.numberOfProofsInput.set('');
      this.walletOptionsService.updateNumberOfProofs(false);
      this.walletOptions.update(options => ({
        ...options,
        numberOfProofs: false
      }));
    }
  }

  onNumberOfProofsChange(value: string): void {
    this.numberOfProofsInput.set(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      this.walletOptionsService.updateNumberOfProofs(numValue);
      this.walletOptions.update(options => ({
        ...options,
        numberOfProofs: numValue
      }));
    }
  }

  onNumberOfProofsInput(event: any): void {
    const value = event.target.value;
    this.onNumberOfProofsChange(value);
  }

  onUseSignedMetadataChange(value: boolean): void {
    this.useSignedMetadata.set(value);
    this.walletOptionsService.updateUseSignedMetadata(value);
    this.walletOptions.update(options => ({
      ...options,
      useSignedMetadata: value
    }));
  }
}

