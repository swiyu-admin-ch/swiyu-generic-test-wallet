import { Injectable, signal, WritableSignal } from '@angular/core';

export interface VCRecord {
  id: string;
  credentialType: string;
  issuedAt: Date;
  sdJwt: string;
}

@Injectable({
  providedIn: 'root'
})
export class VcStoreService {
  private requestedVCs: WritableSignal<VCRecord[]> = signal([]);

  getRequestedVCs(): WritableSignal<VCRecord[]> {
    return this.requestedVCs;
  }

  addVC(credentialType: string, sdJwt: string): void {
    const newVC: VCRecord = {
      id: `vc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      credentialType,
      issuedAt: new Date(),
      sdJwt
    };

    this.requestedVCs.update(vcs => [...vcs, newVC]);
  }

  removeVC(id: string): void {
    this.requestedVCs.update(vcs => vcs.filter(vc => vc.id !== id));
  }

  clearAll(): void {
    this.requestedVCs.set([]);
  }

  getVCCount(): number {
    return this.requestedVCs().length;
  }
}

