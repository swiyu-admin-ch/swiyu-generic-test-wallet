import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TrustStatementVerifierService } from './trust-statement-verifier.service';
import { StatementType } from '../models/trust-statement-verifier.model';

describe('TrustStatementVerifierService - Issuance trust markers', () => {
  let service: TrustStatementVerifierService;

  const TRUST_ROOT = 'did:example:trust-root';
  const ISSUER = 'did:example:issuer';
  const VCT = 'urn:vct:example';

  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

  const buildStatement = (typ: StatementType, payload: object): string =>
    `${encode({ typ, alg: 'ES256', kid: `${TRUST_ROOT}#key-1` })}.${encode(payload)}.signature`;

  const piTLS = (vctValues: string[]) =>
    buildStatement(StatementType.PROTECTED_ISSUANCE_TRUST_LIST_STATEMENT, { vct_values: vctValues });

  const piaTS = (vct: string) =>
    buildStatement(StatementType.PROTECTED_ISSUANCE_AUTHORIZATION_TRUST_STATEMENT, {
      sub: ISSUER,
      can_issue: { vct },
    });

  const verify = async (statements: string[]) => {
    service.initialize(statements, { allowedHosts: new Set() });
    const result = await service.verifyIssuanceStatements(TRUST_ROOT, ISSUER, VCT, [], []);
    return result.markers;
  };

  beforeEach(() => {
    service = TestBed.inject(TrustStatementVerifierService);
  });

  it('should not mark the vct as protected when it is not in the piTLS', async () => {
    const markers = await verify([piTLS(['urn:vct:other'])]);

    expect(markers.governedUseCaseTrustMarker).toBe(false);
    expect(markers.governedUseCaseAuthorizationTrustMarker).toBe(false);
  });

  it('should not mark the vct as protected without a piTLS', async () => {
    const markers = await verify([]);

    expect(markers.governedUseCaseTrustMarker).toBe(false);
  });

  it('should authorize the issuer for a protected vct with a matching piaTS', async () => {
    const markers = await verify([piTLS([VCT]), piaTS(VCT)]);

    expect(markers.governedUseCaseTrustMarker).toBe(true);
    expect(markers.governedUseCaseAuthorizationTrustMarker).toBe(true);
  });

  it('should not authorize the issuer for a protected vct without a piaTS', async () => {
    const markers = await verify([piTLS([VCT])]);

    expect(markers.governedUseCaseTrustMarker).toBe(true);
    expect(markers.governedUseCaseAuthorizationTrustMarker).toBe(false);
  });

  it('should not authorize the issuer when the piaTS is for another vct', async () => {
    const markers = await verify([piTLS([VCT]), piaTS('urn:vct:other')]);

    expect(markers.governedUseCaseAuthorizationTrustMarker).toBe(false);
  });
});
