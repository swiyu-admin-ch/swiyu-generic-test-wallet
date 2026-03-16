import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api-service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('resolveOpenIdMetadataFromDeeplink', () => {
    it('should fetch OpenID metadata from issuer', (done) => {
      const issuerUrl = 'https://issuer.example.com';
      const mockMetadata = {
        credential_endpoint: 'https://issuer.example.com/credential',
        authorization_endpoint: 'https://issuer.example.com/authorize'
      };

      service.resolveOpenIdMetadataFromDeeplink(issuerUrl).subscribe((result) => {
        expect(result).toEqual(mockMetadata);
        done();
      });

      const req = httpMock.expectOne(`${issuerUrl}/.well-known/openid-credential-issuer`);
      expect(req.request.method).toBe('GET');
      req.flush(mockMetadata);
    });

    it('should handle HTTP errors', (done) => {
      const issuerUrl = 'https://issuer.example.com';

      service.resolveOpenIdMetadataFromDeeplink(issuerUrl).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error).toBeDefined();
          done();
        }
      );

      const req = httpMock.expectOne(`${issuerUrl}/.well-known/openid-credential-issuer`);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('resolveOpenIdConfigMetadataFromDeeplink', () => {
    it('should fetch OpenID configuration from issuer', (done) => {
      const issuerUrl = 'https://issuer.example.com';
      const mockConfig = {
        token_endpoint: 'https://issuer.example.com/token'
      };

      service.resolveOpenIdConfigMetadataFromDeeplink(issuerUrl).subscribe((result) => {
        expect(result).toEqual(mockConfig);
        done();
      });

      const req = httpMock.expectOne(`${issuerUrl}/.well-known/openid-configuration`);
      expect(req.request.method).toBe('GET');
      req.flush(mockConfig);
    });

    it('should throw error if issuer URL is missing', (done) => {
      service.resolveOpenIdConfigMetadataFromDeeplink('').subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.message).toContain('No issuer_credential_url provided');
          done();
        }
      );
    });
  });

  describe('getAccessToken', () => {
    it('should fetch access token with pre-authorized code', (done) => {
      const preAuthCode = 'test-code';
      const tokenEndpoint = 'https://issuer.example.com/token';
      const mockToken = {
        access_token: 'token123',
        token_type: 'Bearer'
      };

      service.getAccessToken(preAuthCode, tokenEndpoint).subscribe((result) => {
        expect(result).toEqual(mockToken);
        done();
      });

      const req = httpMock.expectOne(tokenEndpoint);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toContain('pre-authorized_code=test-code');
      req.flush(mockToken);
    });

    it('should throw error if pre-auth code is missing', (done) => {
      service.getAccessToken('', 'https://issuer.example.com/token').subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.message).toContain('No pre-authorized code provided');
          done();
        }
      );
    });

    it('should throw error if token endpoint is missing', (done) => {
      service.getAccessToken('code', '').subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.message).toContain('No pre-authorized code provided');
          done();
        }
      );
    });
  });

  describe('getNonce', () => {
    it('should fetch nonce from endpoint', (done) => {
      const nonceEndpoint = 'https://issuer.example.com/nonce';
      const mockNonce = { c_nonce: 'nonce123', c_nonce_expires_in: 3600 };

      service.getNonce(nonceEndpoint).subscribe((result) => {
        expect(result).toEqual(mockNonce);
        done();
      });

      const req = httpMock.expectOne(nonceEndpoint);
      expect(req.request.method).toBe('POST');
      req.flush(mockNonce);
    });

    it('should throw error if nonce endpoint is missing', (done) => {
      service.getNonce('').subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.message).toContain('No nonce_endpoint provided');
          done();
        }
      );
    });
  });

  describe('submitVerificationResponse', () => {
    it('should submit verification response', (done) => {
      const responseUri = 'https://verifier.example.com/response';
      const vpToken = 'token123';
      const presentationSubmission = {
        id: 'submission1',
        definition_id: 'def1',
        descriptor_map: []
      };

      service.submitVerificationResponse(responseUri, vpToken, presentationSubmission).subscribe((result) => {
        expect(result).toBeDefined();
        done();
      });

      const req = httpMock.expectOne(responseUri);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toContain('vp_token=token123');
      req.flush('Success');
    });

    it('should throw error if response URI is missing', (done) => {
      service.submitVerificationResponse('', 'token', {
        id: 'submission1',
        definition_id: 'def1',
        descriptor_map: []
      }).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.message).toContain('No response_uri provided');
          done();
        }
      );
    });
  });

  describe('Error Handling', () => {
    it('should display CORS error when status is 0', (done) => {
      const issuerUrl = 'https://issuer.example.com';

      service.resolveOpenIdMetadataFromDeeplink(issuerUrl).subscribe(
        () => fail('should have failed'),
        (error) => {
          done();
        }
      );

      const req = httpMock.expectOne(`${issuerUrl}/.well-known/openid-credential-issuer`);
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    });
  });
});


