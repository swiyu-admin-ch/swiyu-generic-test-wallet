import { Injectable } from '@angular/core';

export interface StoredVc {
  vcId: string;
  credential: string;
  credentialType: string;
  issuerId: string;
  storedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class VcStoreService {
  private vcs = new Map<string, StoredVc>();

  storeVc(
    vcId: string,
    credential: string,
    credentialType: string,
    issuerId: string
  ): StoredVc {
    const vc: StoredVc = {
      vcId,
      credential,
      credentialType,
      issuerId,
      storedAt: new Date()
    };

    this.vcs.set(vcId, vc);
    return vc;
  }

  getVcById(vcId: string): StoredVc | undefined {
    return this.vcs.get(vcId);
  }

  getVcByCredentialType(credentialType: string): StoredVc[] {
    return Array.from(this.vcs.values()).filter(vc => vc.credentialType === credentialType);
  }

  getVcsByIssuerId(issuerId: string): StoredVc[] {
    return Array.from(this.vcs.values()).filter(vc => vc.issuerId === issuerId);
  }

  getAllVcs(): StoredVc[] {
    return Array.from(this.vcs.values());
  }

  deleteVcById(vcId: string): boolean {
    return this.vcs.delete(vcId);
  }

  clearAllVcs(): void {
    this.vcs.clear();
  }
}

