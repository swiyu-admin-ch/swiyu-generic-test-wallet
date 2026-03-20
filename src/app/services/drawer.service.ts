import { Injectable } from '@angular/core';
import { WritableSignal, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DrawerService {
  private isWalletInfoDrawerOpen: WritableSignal<boolean> = signal(true);

  getIsWalletInfoDrawerOpen(): WritableSignal<boolean> {
    return this.isWalletInfoDrawerOpen;
  }

  toggleWalletInfoDrawer(): void {
    this.isWalletInfoDrawerOpen.update(value => !value);
  }

  openWalletInfoDrawer(): void {
    this.isWalletInfoDrawerOpen.set(true);
  }

  closeWalletInfoDrawer(): void {
    this.isWalletInfoDrawerOpen.set(false);
  }
}

