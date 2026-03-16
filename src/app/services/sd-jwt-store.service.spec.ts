import { TestBed } from '@angular/core/testing';
import { SdJwtStoreService } from './sd-jwt-store.service';

describe('SdJwtStoreService', () => {
  let service: SdJwtStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SdJwtStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set and get issuance SD-JWT', () => {
    const testJwt = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...';
    service.setIssuanceSdJwt(testJwt);
    expect(service.getIssuanceSdJwt()()).toBe(testJwt);
  });

  it('should set and get verification SD-JWT', () => {
    const testJwt = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...';
    service.setVerificationSdJwt(testJwt);
    expect(service.getVerificationSdJwt()()).toBe(testJwt);
  });

  it('should keep issuance and verification SD-JWTs separate', () => {
    const issuanceJwt = 'issuance_jwt_123';
    const verificationJwt = 'verification_jwt_456';

    service.setIssuanceSdJwt(issuanceJwt);
    service.setVerificationSdJwt(verificationJwt);

    expect(service.getIssuanceSdJwt()()).toBe(issuanceJwt);
    expect(service.getVerificationSdJwt()()).toBe(verificationJwt);
  });

  it('should clear all SD-JWTs', () => {
    service.setIssuanceSdJwt('test_issuance');
    service.setVerificationSdJwt('test_verification');

    service.clearAll();

    expect(service.getIssuanceSdJwt()()).toBe('');
    expect(service.getVerificationSdJwt()()).toBe('');
  });

  it('should return writable signals', () => {
    const issuanceSignal = service.getIssuanceSdJwt();
    expect(typeof issuanceSignal).toBe('function');

    const verificationSignal = service.getVerificationSdJwt();
    expect(typeof verificationSignal).toBe('function');
  });
});

