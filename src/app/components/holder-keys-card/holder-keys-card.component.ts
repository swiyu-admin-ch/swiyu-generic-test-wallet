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
import { WalletService } from '@services/wallet-service';
import { signal, WritableSignal } from '@angular/core';

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
  private walletService = inject(WalletService);

  holderKeyGeneratedAt: WritableSignal<Date | null> = signal(null);
  numberOfProofsInput: WritableSignal<string> = signal('');
  useCustomNumberOfProofs: WritableSignal<boolean> = signal(false);

  walletOptions = this.walletService.getOptionsSignal();
  requestedVCs = this.walletService.getRequestedVCs();
  ephemeralKeysUrl = 'https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet?tab=readme-ov-file#ephemeral-holder-keys-and-page-refresh';

  ngOnInit(): void {
    this.updateKeyGenerationTime();
    this.initializeNumberOfProofsInput();

    const checkInterval = setInterval(() => {
      const newTime = this.holderKeyService.getKeyGeneratedAt();
      if (newTime && newTime !== this.holderKeyGeneratedAt()) {
        this.holderKeyGeneratedAt.set(newTime);
      }
    }, 1000);

    window.addEventListener('beforeunload', () => clearInterval(checkInterval));
  }

  private updateKeyGenerationTime(): void {
    const keyTime = this.holderKeyService.getKeyGeneratedAt();
    if (keyTime) {
      this.holderKeyGeneratedAt.set(keyTime);
    }
  }

  private initializeNumberOfProofsInput(): void {
    const options = this.walletService.getOptions();
    if (typeof options.numberOfProofs === 'number') {
      this.useCustomNumberOfProofs.set(true);
      this.numberOfProofsInput.set(options.numberOfProofs.toString());
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

  // ...existing code...

  onPayloadEncryptionChange(value: boolean): void {
    this.walletService.updatePayloadEncryptionPreference(value);
  }

  onNumberOfProofsToggle(useCustom: boolean): void {
    this.useCustomNumberOfProofs.set(useCustom);
    if (!useCustom) {
      this.numberOfProofsInput.set('');
      this.walletService.updateNumberOfProofs(false);
    }
  }

  onNumberOfProofsChange(value: string): void {
    this.numberOfProofsInput.set(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      this.walletService.updateNumberOfProofs(numValue);
    }
  }

  onNumberOfProofsInput(event: any): void {
    const value = event.target.value;
    this.onNumberOfProofsChange(value);
  }

  onUseSignedMetadataChange(value: boolean): void {
    this.walletService.updateUseSignedMetadata(value);
  }

  copyCredentialToClipboard(sdJwt: string, credentialType: string): void {
    navigator.clipboard.writeText(sdJwt).then(() => {
      console.log(`Credential "${credentialType}" copied to clipboard`);
    }).catch(err => {
      console.error('Failed to copy credential to clipboard:', err);
    });
  }
}
