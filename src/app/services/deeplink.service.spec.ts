import { TestBed } from '@angular/core/testing';
import { DeeplinkService } from './deeplink.service';

describe('DeeplinkService', () => {
  let service: DeeplinkService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DeeplinkService]
    });

    service = TestBed.inject(DeeplinkService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('decodeSwiyuDeeplink', () => {
    it('should decode a valid swiyu deeplink and return parsed credential offer', () => {
      const deeplink = 'swiyu://?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%2243a7bd4e-d487-4564-8464-68de1dd98614%22%7D%7D%2C%22credential_issuer%22%3A%22https%3A%2F%2Fbcs-intg.admin.ch%2Fbcs-web%2Fissuer-agent%2Foid4vci%2Fc65535ab-a343-4513-b6a8-a92d567fc574%22%2C%22credential_configuration_ids%22%3A%5B%22betaid-sdjwt%22%5D%7D';

      const result = service.decodeSwiyuDeeplink(deeplink);

      expect(result).toBeTruthy();
      expect(result.grants).toBeTruthy();
      expect(result.credential_issuer).toBe('https://bcs-intg.admin.ch/bcs-web/issuer-agent/oid4vci/c65535ab-a343-4513-b6a8-a92d567fc574');
      expect(result.credential_configuration_ids).toEqual(['betaid-sdjwt']);
    });

    it('should throw error if deeplink is empty', () => {
      expect(() => service.decodeSwiyuDeeplink('')).toThrowError('No deeplink provided');
    });

    it('should throw error if deeplink does not start with swiyu://', () => {
      expect(() => service.decodeSwiyuDeeplink('http://example.com')).toThrowError('Invalid deeplink format');
    });

    it('should throw error if credential_offer parameter is missing', () => {
      const invalidDeeplink = 'swiyu://?some_param=value';
      expect(() => service.decodeSwiyuDeeplink(invalidDeeplink)).toThrowError('credential_offer parameter not found');
    });

    it('should throw error if credential_offer JSON is invalid', () => {
      const invalidDeeplink = 'swiyu://?credential_offer=invalid%20json';
      expect(() => service.decodeSwiyuDeeplink(invalidDeeplink)).toThrowError();
    });

    it('should throw error if required fields are missing', () => {
      const missingFieldsDeeplink = 'swiyu://?credential_offer=%7B%22some_field%22%3A%22value%22%7D';
      expect(() => service.decodeSwiyuDeeplink(missingFieldsDeeplink)).toThrowError('Missing required fields');
    });
  });
});

