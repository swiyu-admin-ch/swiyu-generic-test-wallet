import { TestBed } from '@angular/core/testing';
import { VcStoreService } from './vc-store.service';

describe('VcStoreService', () => {
  let service: VcStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VcStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add a VC', () => {
    service.addVC('test_credential', 'test_sd_jwt');
    expect(service.getVCCount()).toBe(1);
  });

  it('should track multiple VCs', () => {
    service.addVC('credential_1', 'jwt_1');
    service.addVC('credential_2', 'jwt_2');
    expect(service.getVCCount()).toBe(2);
  });

  it('should remove a VC by id', () => {
    service.addVC('test_credential', 'test_sd_jwt');
    const vcs = service.getRequestedVCs()();
    if (vcs.length > 0) {
      service.removeVC(vcs[0].id);
      expect(service.getVCCount()).toBe(0);
    }
  });

  it('should clear all VCs', () => {
    service.addVC('credential_1', 'jwt_1');
    service.addVC('credential_2', 'jwt_2');
    service.clearAll();
    expect(service.getVCCount()).toBe(0);
  });
});

