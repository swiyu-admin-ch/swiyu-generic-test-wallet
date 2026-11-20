import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpHeaders, HttpParams, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { DpopService } from './dpop-service';
import { OIDVCIService } from './oidvci-service';
import { DpopKeyPair } from './vc-key-store.service';

describe('OIDVCIService', () => {
  let service: OIDVCIService;
  let httpTesting: HttpTestingController;

  const DID_LOG_URL = 'https://registry.example.com/did.jsonl';
  const NONCE_URL = 'https://issuer.example/nonce';
  const TOKEN_URL = 'https://issuer.example/token';
  const CREDENTIAL_URL = 'https://issuer.example/credential';
  const dpopKeys = {} as DpopKeyPair;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OIDVCIService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  it('should return the entry of a single line DID log', async () => {
    const entry = firstValueFrom(service.fetchRegistryEntry(DID_LOG_URL));
    httpTesting.expectOne(DID_LOG_URL).flush('{"versionId":"1-abc"}\n');

    expect(await entry).toEqual({ versionId: '1-abc' });
  });

  it('should return the last entry of a multi line DID log', async () => {
    const entry = firstValueFrom(service.fetchRegistryEntry(DID_LOG_URL));
    httpTesting.expectOne(DID_LOG_URL).flush('{"versionId":"1-abc"}\n{"versionId":"2-def"}');

    expect(await entry).toEqual({ versionId: '2-def' });
  });

  it('uses the DPoP-Nonce header for the token proof and preserves the transaction code', async () => {
    const createProof = vi
      .spyOn(TestBed.inject(DpopService), 'createProof')
      .mockResolvedValue('token-proof');

    const token = firstValueFrom(
      service.fetchAccessToken(TOKEN_URL, NONCE_URL, 'pre-auth-code', dpopKeys, '012345'),
    );
    httpTesting.expectOne(NONCE_URL).flush({ c_nonce: 'credential-nonce' }, {
      headers: { 'DPoP-Nonce': 'dpop-nonce' },
    });

    const request = await vi.waitFor(() => httpTesting.expectOne(TOKEN_URL));
    expect(createProof).toHaveBeenCalledWith(dpopKeys, 'POST', TOKEN_URL, 'dpop-nonce');
    expect(request.request.headers.get('DPoP')).toBe('token-proof');
    const params = new HttpParams({ fromString: request.request.body });
    expect(params.get('tx_code')).toBe('012345');
    request.flush({ access_token: 'access-token' });

    expect(await token).toEqual({ access_token: 'access-token' });
  });

  it('signs a fresh proof and repeats the token request after a nonce challenge', async () => {
    const createProof = vi
      .spyOn(TestBed.inject(DpopService), 'createProof')
      .mockResolvedValueOnce('initial-proof')
      .mockResolvedValueOnce('retry-proof');

    const token = firstValueFrom(
      service.fetchAccessToken(TOKEN_URL, NONCE_URL, 'pre-auth-code', dpopKeys),
    );
    httpTesting.expectOne(NONCE_URL).flush({ c_nonce: 'credential-nonce' });
    const initial = await vi.waitFor(() => httpTesting.expectOne(TOKEN_URL));
    initial.flush({ error: 'use_dpop_nonce' }, {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'DPoP-Nonce': 'challenge-nonce' },
    });

    const retry = await vi.waitFor(() => httpTesting.expectOne(TOKEN_URL));
    expect(createProof).toHaveBeenNthCalledWith(1, dpopKeys, 'POST', TOKEN_URL, undefined);
    expect(createProof).toHaveBeenNthCalledWith(
      2, dpopKeys, 'POST', TOKEN_URL, 'challenge-nonce',
    );
    expect(initial.request.headers.get('DPoP')).toBe('initial-proof');
    expect(retry.request.headers.get('DPoP')).toBe('retry-proof');
    expect(retry.request.body).toBe(initial.request.body);
    retry.flush({ access_token: 'access-token' });

    expect(await token).toEqual({ access_token: 'access-token' });
  });

  it.each([
    ['use_dpop_nonce', new HttpHeaders()],
    ['invalid_tx_code', new HttpHeaders({ 'DPoP-Nonce': 'dpop-nonce' })],
  ])('propagates %s when there is no usable nonce challenge', async (error, headers) => {
    const createProof = vi
      .spyOn(TestBed.inject(DpopService), 'createProof')
      .mockResolvedValue('token-proof');

    const token = firstValueFrom(
      service.fetchAccessToken(TOKEN_URL, NONCE_URL, 'pre-auth-code', dpopKeys),
    );
    const rejection = expect(token).rejects.toMatchObject({ error: { error } });
    httpTesting.expectOne(NONCE_URL).flush({ c_nonce: 'credential-nonce' });
    const request = await vi.waitFor(() => httpTesting.expectOne(TOKEN_URL));
    request.flush({ error }, { status: 400, statusText: 'Bad Request', headers });

    await rejection;
    expect(createProof).toHaveBeenCalledTimes(1);
    httpTesting.expectNone(TOKEN_URL);
  });

  it('uses the DPoP-Nonce header and access token for the credential request proof', async () => {
    const createProof = vi
      .spyOn(TestBed.inject(DpopService), 'createProof')
      .mockResolvedValue('credential-proof');

    const credential = firstValueFrom(
      service.fetchCredential(CREDENTIAL_URL, NONCE_URL, {}, 'access-token', dpopKeys),
    );
    httpTesting.expectOne(NONCE_URL).flush({ c_nonce: 'credential-nonce' }, {
      headers: { 'DPoP-Nonce': 'dpop-nonce' },
    });

    const request = await vi.waitFor(() => httpTesting.expectOne(CREDENTIAL_URL));
    expect(createProof).toHaveBeenCalledWith(
      dpopKeys, 'POST', CREDENTIAL_URL, 'dpop-nonce', 'access-token',
    );
    expect(request.request.headers.get('DPoP')).toBe('credential-proof');
    request.flush({ credentials: [] });

    expect(await credential).toEqual({ credentials: [] });
  });
});
