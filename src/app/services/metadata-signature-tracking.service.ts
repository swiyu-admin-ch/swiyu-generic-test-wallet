import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MetadataSignatureTrackingService {
  private openIdMetadataIsSigned: WritableSignal<boolean> = signal(false);
  private openIdConfigMetadataIsSigned: WritableSignal<boolean> = signal(false);

  getOpenIdMetadataIsSigned(): WritableSignal<boolean> {
    return this.openIdMetadataIsSigned;
  }

  setOpenIdMetadataIsSigned(isSigned: boolean): void {
    this.openIdMetadataIsSigned.set(isSigned);
  }

  getOpenIdConfigMetadataIsSigned(): WritableSignal<boolean> {
    return this.openIdConfigMetadataIsSigned;
  }

  setOpenIdConfigMetadataIsSigned(isSigned: boolean): void {
    this.openIdConfigMetadataIsSigned.set(isSigned);
  }

  resetAll(): void {
    this.openIdMetadataIsSigned.set(false);
    this.openIdConfigMetadataIsSigned.set(false);
  }
}

