import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { HolderKeyService } from '@services/holder-key.service';
import { WritableSignal, signal } from '@angular/core';

@Component({
  selector: 'app-holder-keys-card',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatCardModule
  ],
  templateUrl: './holder-keys-card.component.html'
})
export class HolderKeysCardComponent implements OnInit {
  private holderKeyService = inject(HolderKeyService);

  holderKeyGeneratedAt: WritableSignal<Date | null> = signal(null);
  isExpanded: WritableSignal<boolean> = signal(true);
  ephemeralKeysUrl = 'https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet?tab=readme-ov-file#ephemeral-holder-keys-and-page-refresh';

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
}

