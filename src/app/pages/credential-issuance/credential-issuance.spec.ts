import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DpopService } from '@app/services/dpop-service';
import { DpopKeyPair, VcKeyStoreService } from '@app/services/vc-key-store.service';
import { WalletService } from '@app/services/wallet-service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CredentialIssuance } from './credential-issuance';

describe('Credential issuance DPoP settings', () => {
  const issuer = 'https://issuer.example';
  const nonceUrl = `${issuer}/nonce`;
  const tokenUrl = `${issuer}/token`;
  const credentialUrl = `${issuer}/credential`;
  const configId = 'test-credential';
  const offer = {
    credential_issuer: issuer,
    credential_configuration_ids: [configId],
    grants: {
      'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
        'pre-authorized_code': 'test-code',
      },
    },
  };
  const deeplink = `openid-credential-offer://?credential_offer=${encodeURIComponent(JSON.stringify(offer))}`;

  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('wallet_options');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.removeItem('wallet_options');
    vi.restoreAllMocks();
  });

  it.each([
    { useDPoP: undefined, expected: true },
    { useDPoP: false, expected: false },
  ])('honors the stored DPoP setting $useDPoP for the entire issuance', async ({ useDPoP, expected }) => {
    localStorage.setItem('wallet_options', JSON.stringify({ useSignedMetadata: false, useDPoP }));
    const wallet = TestBed.inject(WalletService);
    expect(wallet.getOptions().useDPoP).toBe(expected);

    const keys = {} as DpopKeyPair;
    const generateKeyPair = vi.spyOn(TestBed.inject(VcKeyStoreService), 'generateDpopKeyPair')
      .mockResolvedValue(keys);
    const createProof = vi.spyOn(TestBed.inject(DpopService), 'createProof')
      .mockResolvedValueOnce('token-proof')
      .mockResolvedValueOnce('credential-proof');
    vi.spyOn(wallet, 'buildRequestCredential').mockResolvedValue('encrypted-request');

    const issuance = TestBed.runInInjectionContext(() => new CredentialIssuance());
    issuance.onResolve(deeplink);
    httpTesting.expectOne(`${issuer}/.well-known/openid-credential-issuer`).flush({
      credential_issuer: issuer,
      credential_endpoint: credentialUrl,
      nonce_endpoint: nonceUrl,
    });
    httpTesting.expectOne(`${issuer}/.well-known/openid-configuration`).flush({ token_endpoint: tokenUrl });
    httpTesting.expectOne(nonceUrl).flush({ c_nonce: 'initial-holder-nonce' });

    if (expected) {
      await respondWithDpopNonce('token-dpop-nonce');
    }
    const token = await vi.waitFor(() => httpTesting.expectOne(tokenUrl));
    expect(token.request.headers.get('DPoP')).toBe(expected ? 'token-proof' : null);

    wallet.updateUseDpop(!expected);
    token.flush({ access_token: 'access-token', token_type: expected ? 'DPoP' : 'Bearer' });
    httpTesting.expectOne(nonceUrl).flush({ c_nonce: 'credential-holder-nonce' });

    if (expected) {
      await respondWithDpopNonce('credential-dpop-nonce');
      expect(createProof).toHaveBeenNthCalledWith(1, keys, 'POST', tokenUrl, 'token-dpop-nonce');
      expect(createProof).toHaveBeenNthCalledWith(
        2, keys, 'POST', credentialUrl, 'credential-dpop-nonce', 'access-token',
      );
    }

    const credential = await vi.waitFor(() => httpTesting.expectOne(credentialUrl));
    expect(credential.request.headers.get('DPoP')).toBe(expected ? 'credential-proof' : null);
    expect(credential.request.headers.get('Authorization')).toBe(
      expected ? 'DPoP access-token' : 'Bearer access-token',
    );
    expect(generateKeyPair).toHaveBeenCalledTimes(expected ? 1 : 0);
    expect(createProof).toHaveBeenCalledTimes(expected ? 2 : 0);
    issuance.onClear();
  });

  async function respondWithDpopNonce(nonce: string): Promise<void> {
    const request = await vi.waitFor(() => httpTesting.expectOne(nonceUrl));
    request.flush({ c_nonce: 'holder-nonce' }, { headers: { 'DPoP-Nonce': nonce } });
  }
});
