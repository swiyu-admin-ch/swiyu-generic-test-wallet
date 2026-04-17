import { describe, it, expect, beforeEach } from 'vitest';
import { DeeplinkService } from './deeplink.service';
import { CredentialOffer, GrantConfig } from '@models/credential-offer';

describe('DeeplinkService', () => {
  let service: DeeplinkService;

  const SWIYU_PROTOCOL = 'swiyu://';
  const OPENID_PROTOCOL = 'openid-credential-offer://';
  const ISSUER_URL = 'https://issuer.example.com';
  const CREDENTIAL_TYPE = 'credential-type-1';

  const SWIYU_VERIFY = 'swiyu-verify://';
  const OPENID4VP = 'openid4vp://';
  const CLIENT_ID = 'did:example:client';
  const REQUEST_URI = 'https://verifier.example.com/request';

  const buildCredentialOffer = (
    issuerUrl: string,
    configIds: string[]
  ): CredentialOffer => ({
    credential_issuer: issuerUrl,
    credential_configuration_ids: configIds
  });

  const buildIssuanceDeeplink = (protocol: string, offer: CredentialOffer): string => {
    const encoded = encodeURIComponent(JSON.stringify(offer));
    return `${protocol}?credential_offer=${encoded}`;
  };

  const buildVerificationDeeplink = (
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

  describe('decodeSwiyuDeeplink - Issuance', () => {
    it('should decode a valid swiyu:// deeplink', () => {
      const offer = buildCredentialOffer(ISSUER_URL, [CREDENTIAL_TYPE]);
      const deeplink = buildIssuanceDeeplink(SWIYU_PROTOCOL, offer);

      const result = service.decodeSwiyuDeeplink(deeplink);

      expect(result.credential_issuer).toBe(ISSUER_URL);
      expect(result.credential_configuration_ids).toContain(CREDENTIAL_TYPE);
    });

    it('should decode a valid openid-credential-offer:// deeplink', () => {
      const offer = buildCredentialOffer(ISSUER_URL, [CREDENTIAL_TYPE]);
      const deeplink = buildIssuanceDeeplink(OPENID_PROTOCOL, offer);

      const result = service.decodeSwiyuDeeplink(deeplink);

      expect(result.credential_issuer).toBe(ISSUER_URL);
      expect(result.credential_configuration_ids).toContain(CREDENTIAL_TYPE);
    });

    it('should handle multiple credential_configuration_ids', () => {
      const types = ['type-1', 'type-2', 'type-3'];
      const offer = buildCredentialOffer(ISSUER_URL, types);
      const deeplink = buildIssuanceDeeplink(SWIYU_PROTOCOL, offer);

      const result = service.decodeSwiyuDeeplink(deeplink);

      expect(result.credential_configuration_ids).toEqual(types);
    });

    it('should throw error for empty deeplink', () => {
      expect(() => service.decodeSwiyuDeeplink('')).toThrow('No deeplink provided');
    });

    it('should throw error for unsupported protocol', () => {
      expect(() => service.decodeSwiyuDeeplink('https://example.com')).toThrow(
        'Invalid deeplink format'
      );
    });

    it('should throw error when required fields are missing', () => {
      const invalidOffer = { credential_issuer: ISSUER_URL };
      const encoded = encodeURIComponent(JSON.stringify(invalidOffer));
      const deeplink = `${SWIYU_PROTOCOL}?credential_offer=${encoded}`;

      expect(() => service.decodeSwiyuDeeplink(deeplink)).toThrow(
        'Missing required fields in credential offer'
      );
    });
  });

  describe('decodeVerificationDeeplink - Verification', () => {
    it('should decode a valid swiyu-verify:// deeplink', () => {
      const deeplink = buildVerificationDeeplink(SWIYU_VERIFY, CLIENT_ID, REQUEST_URI);

      const result = service.decodeVerificationDeeplink(deeplink);

      expect(result['client_id']).toBe(CLIENT_ID);
      expect(result['request_uri']).toBe(REQUEST_URI);
    });

    it('should decode a valid openid4vp:// deeplink', () => {
      const deeplink = buildVerificationDeeplink(OPENID4VP, CLIENT_ID, REQUEST_URI);

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

