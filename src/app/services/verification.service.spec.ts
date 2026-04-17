import { describe, it, expect, beforeEach } from 'vitest';
import { DeeplinkService } from './deeplink.service';

describe('DeeplinkService - Verification Deeplinks', () => {
  let service: DeeplinkService;

  const SWIYU_VERIFY = 'swiyu-verify://';
  const OPENID4VP = 'openid4vp://';
  const CLIENT_ID = 'did:example:client';
  const REQUEST_URI = 'https://verifier.example.com/request';

  const buildUrlSchemeDeeplink = (
    protocol: string,
    clientId: string,
    requestUri: string
  ): string => {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('request_uri', requestUri);
    return `${protocol}?${params.toString()}`;
  };

  beforeEach(() => {
    service = new DeeplinkService();
  });

  describe('decodeVerificationDeeplink', () => {
    it('should decode a valid swiyu-verify:// deeplink', () => {
      const deeplink = buildUrlSchemeDeeplink(SWIYU_VERIFY, CLIENT_ID, REQUEST_URI);

      const result = service.decodeVerificationDeeplink(deeplink);

      expect(result['client_id']).toBe(CLIENT_ID);
      expect(result['request_uri']).toBe(REQUEST_URI);
    });

    it('should decode a valid openid4vp:// deeplink', () => {
      const deeplink = buildUrlSchemeDeeplink(OPENID4VP, CLIENT_ID, REQUEST_URI);

      const result = service.decodeVerificationDeeplink(deeplink);

      expect(result['client_id']).toBe(CLIENT_ID);
      expect(result['request_uri']).toBe(REQUEST_URI);
    });

    it('should handle https:// URL as request_uri', () => {
      const url = 'https://verifier.example.com/request-object/123';

      const result = service.decodeVerificationDeeplink(url);

      expect(result['request_uri']).toBe(url);
    });

    it('should handle http:// URL as request_uri', () => {
      const url = 'http://localhost:3000/request-object';

      const result = service.decodeVerificationDeeplink(url);

      expect(result['request_uri']).toBe(url);
    });

    it('should throw error for empty deeplink', () => {
      expect(() => service.decodeVerificationDeeplink('')).toThrow('decode');
    });

    it('should throw error for unsupported protocol', () => {
      expect(() => service.decodeVerificationDeeplink('unsupported://data')).toThrow('decode');
    });

    it('should preserve URL with query parameters', () => {
      const url = 'https://verifier.example.com/api?id=123&token=abc';

      const result = service.decodeVerificationDeeplink(url);

      expect(result['request_uri']).toBe(url);
    });
  });
});

