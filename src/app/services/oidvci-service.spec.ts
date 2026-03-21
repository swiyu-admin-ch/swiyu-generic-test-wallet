import { TestBed } from '@angular/core/testing';
import { OIDVCIService } from './oidvci-service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

describe('OidvciService', () => {
  let service: OIDVCIService;
  let httpMock: HttpTestingController;

  const issuerUrl = 'https://example.com';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(OIDVCIService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch issuer metadata (unsigned)', () => {
    const mockResponse = { credential_endpoint: 'test' };

    service.fetchIssuerMetadata(issuerUrl).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(
      `${issuerUrl}/.well-known/openid-credential-issuer`
    );

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe('application/json');

    req.flush(mockResponse);
  });

  it('should fetch issuer metadata (signed)', () => {
    const mockJwt = 'header.payload.signature';

    service.fetchIssuerMetadata(issuerUrl, true).subscribe((res) => {
      expect(res).toBe(mockJwt);
    });

    const req = httpMock.expectOne(
      `${issuerUrl}/.well-known/openid-credential-issuer`
    );

    expect(req.request.headers.get('Accept')).toBe('application/jwt');

    req.flush(mockJwt);
  });

  it('should fetch OpenID configuration (unsigned)', () => {
    const mockResponse = { token_endpoint: 'test' };

    service.fetchOpenIdConfiguration(issuerUrl).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(
      `${issuerUrl}/.well-known/openid-configuration`
    );

    expect(req.request.headers.get('Accept')).toBe('application/json');

    req.flush(mockResponse);
  });

  it('should fetch OpenID configuration (signed)', () => {
    const mockJwt = 'header.payload.signature';

    service.fetchOpenIdConfiguration(issuerUrl, true).subscribe((res) => {
      expect(res).toBe(mockJwt);
    });

    const req = httpMock.expectOne(
      `${issuerUrl}/.well-known/openid-configuration`
    );

    expect(req.request.headers.get('Accept')).toBe('application/jwt');

    req.flush(mockJwt);
  });
});