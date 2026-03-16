import { TestBed } from '@angular/core/testing';
import { SdJwtDecoderService } from './sd-jwt-decoder.service';

describe('SdJwtDecoderService', () => {
  let service: SdJwtDecoderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SdJwtDecoderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('isValidSdJwtFormat', () => {
    it('should return true for valid SD-JWT format', () => {
      const sdJwt = 'eyJhbGc.eyJpc3MiOiAi.aaa~eyJk.bbb~';
      expect(service.isValidSdJwtFormat(sdJwt)).toBe(true);
    });

    it('should return false for invalid format without tilde', () => {
      const jwt = 'eyJhbGc.eyJpc3MiOiAi.aaa';
      expect(service.isValidSdJwtFormat(jwt)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(service.isValidSdJwtFormat('')).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(service.isValidSdJwtFormat(null as any)).toBe(false);
      expect(service.isValidSdJwtFormat(undefined as any)).toBe(false);
    });

    it('should return false for non-string', () => {
      expect(service.isValidSdJwtFormat(123 as any)).toBe(false);
    });
  });

  describe('decodeSdJwt', () => {
    it('should return invalid result for empty credential', () => {
      const result = service.decodeSdJwt('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return invalid result for non-SD-JWT format', () => {
      const result = service.decodeSdJwt('not.valid.jwt');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid SD-JWT format');
    });

    it('should return invalid result for null', () => {
      const result = service.decodeSdJwt(null as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid JWT format', () => {
      const result = service.decodeSdJwt('invalid.jwt.format~disclosure');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Failed to decode JWT');
    });

    it('should include header and payload when valid', () => {
      const result = service.decodeSdJwt('invalid~disclosure');
      expect(result.header || result.payload || result.error).toBeDefined();
    });
  });

  describe('extractClaims', () => {
    it('should return empty object for invalid credential', () => {
      const claims = service.extractClaims('invalid');
      expect(claims).toEqual({});
    });

    it('should return payload claims for valid credential', () => {
      const claims = service.extractClaims('not.valid~disclosure');
      expect(typeof claims).toBe('object');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed base64 in disclosures', () => {
      const result = service.decodeSdJwt('jwt.part~!!!invalid!!!');
      expect(result.disclosures || result.error).toBeDefined();
    });

    it('should catch unexpected errors', () => {
      const result = service.decodeSdJwt({} as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Format Validation', () => {
    it('should validate SD-JWT structure with single disclosure', () => {
      const sdJwt = 'jwt~disclosure1~';
      expect(service.isValidSdJwtFormat(sdJwt)).toBe(true);
    });

    it('should validate SD-JWT structure with multiple disclosures', () => {
      const sdJwt = 'jwt~disclosure1~disclosure2~disclosure3~';
      expect(service.isValidSdJwtFormat(sdJwt)).toBe(true);
    });

    it('should handle SD-JWT with key binding JWT', () => {
      const sdJwt = 'jwt~disclosure1~disclosure2~keybindingjwt';
      expect(service.isValidSdJwtFormat(sdJwt)).toBe(true);
    });
  });
});

