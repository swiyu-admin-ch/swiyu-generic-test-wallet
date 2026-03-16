import { TestBed } from '@angular/core/testing';
import { HolderKeyService } from './holder-key.service';

describe('HolderKeyService', () => {
  let service: HolderKeyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HolderKeyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initializeKeys', () => {
    it('should initialize keys', async () => {
      await service.initializeKeys();

      expect(service.getPrivateKey()).toBeTruthy();
      expect(service.getPublicKey()).toBeTruthy();
      expect(service.getJwk()).toBeTruthy();
    });

    it('should set key generation timestamp', async () => {
      await service.initializeKeys();

      const timestamp = service.getKeyGeneratedAt();
      expect(timestamp).toBeTruthy();
      expect(timestamp).toBeInstanceOf(Date);
    });

    it('should generate valid ECDSA keys', async () => {
      await service.initializeKeys();

      const privateKey = service.getPrivateKey();
      expect(privateKey?.type).toBe('private');
      expect(privateKey?.algorithm.name).toBe('ECDSA');
    });

    it('should generate valid JWK', async () => {
      await service.initializeKeys();

      const jwk = service.getJwk();
      expect(jwk).toBeTruthy();
      expect(jwk?.kty).toBe('EC');
      expect(jwk?.crv).toBe('P-256');
    });
  });

  describe('getPrivateKey', () => {
    it('should return initialized private key', async () => {
      await service.initializeKeys();
      const key = service.getPrivateKey();
      expect(key).toBeTruthy();
    });

    it('should return null before initialization', () => {
      const freshService = new HolderKeyService();
      expect(freshService.getPrivateKey()).toBeNull();
    });
  });

  describe('getPublicKey', () => {
    it('should return initialized public key', async () => {
      await service.initializeKeys();
      const key = service.getPublicKey();
      expect(key).toBeTruthy();
    });

    it('should return null before initialization', () => {
      const freshService = new HolderKeyService();
      expect(freshService.getPublicKey()).toBeNull();
    });
  });

  describe('getJwk', () => {
    it('should return initialized JWK', async () => {
      await service.initializeKeys();
      const jwk = service.getJwk();
      expect(jwk).toBeTruthy();
    });

    it('should return null before initialization', () => {
      const freshService = new HolderKeyService();
      expect(freshService.getJwk()).toBeNull();
    });
  });

  describe('getKeyGeneratedAt', () => {
    it('should return null before initialization', () => {
      const freshService = new HolderKeyService();
      expect(freshService.getKeyGeneratedAt()).toBeNull();
    });

    it('should return timestamp after initialization', async () => {
      const beforeInit = new Date();
      await service.initializeKeys();
      const timestamp = service.getKeyGeneratedAt();
      const afterInit = new Date();

      expect(timestamp).toBeTruthy();
      expect(timestamp!.getTime()).toBeGreaterThanOrEqual(beforeInit.getTime());
      expect(timestamp!.getTime()).toBeLessThanOrEqual(afterInit.getTime());
    });
  });

  describe('hasKeys', () => {
    it('should return false before initialization', () => {
      const freshService = new HolderKeyService();
      expect(freshService.hasKeys()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await service.initializeKeys();
      expect(service.hasKeys()).toBe(true);
    });
  });

  describe('Key Reinitialization', () => {
    it('should update keys and timestamp on reinitialization', async () => {
      await service.initializeKeys();
      const firstTimestamp = service.getKeyGeneratedAt();
      const firstKey = service.getPrivateKey();

      await new Promise(resolve => setTimeout(resolve, 10));

      await service.initializeKeys();
      const secondTimestamp = service.getKeyGeneratedAt();
      const secondKey = service.getPrivateKey();

      expect(secondTimestamp?.getTime()).toBeGreaterThan(firstTimestamp!.getTime());
      expect(secondKey).not.toBe(firstKey);
    });
  });
});

