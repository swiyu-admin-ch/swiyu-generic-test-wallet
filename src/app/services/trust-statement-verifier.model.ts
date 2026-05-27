export interface Statement {
  typ: StatementType;
  alg: string;
  kid: string;
  profileVersion: string;
  iat: number;
  exp: number;
  serializedJwt: string;
}

export enum StatementType {
  IDENTITY_TRUST_STATEMENT = "swiyu-identity-trust-statement+jwt",
  PROTECTED_ISSUANCE_TRUST_LIST_STATEMENT = "piTLS",
  PROTECTED_ISSUANCE_AUTHORIZATION_TRUST_STATEMENT = "piaTS",
  PROTECTED_VERIFICATION_AUTHORIZATION_TRUST_STATEMENT = "pvaTS",
  VERIFICATION_QUERY_PUBLIC_STATEMENT = "vqPS",
  NON_COMPLIANCE_TRUST_LIST_STATEMENT = "swiyu-non-compliance-trust-list-statement+jwt",
}

export interface StatefulStatement extends Statement {
  statusListUri: string;
  statusIndex: number;
}

export interface TrustStatement extends Statement {
  sub: string;
}

export interface IdentityTrustStatement extends TrustStatement {}

export interface NonComplianceActor {
  actor: string;
  reason: string;
  flaggedAt: string;
}

export interface NonComplianceTrustListStatement extends TrustStatement {
  nonCompliantActors: NonComplianceActor[];
}

export interface ProtectedIssuanceTrustListStatement extends StatefulStatement {
  vctValues: string[];
}

export interface ProtectedIssuanceAuthorizationTrustStatement extends TrustStatement {
  canIssue: {
    vct: string;
  };
}

export interface ProtectedVerificationAuthorizationTrustStatement extends TrustStatement {
  authorizedFields: string[];
}

export interface VerificationQueryPublicStatement extends TrustStatement {
  request: {
    query: unknown;
  };
}

export interface TokenStatusListDto {
  bits: number;
  statusListData: string;
}

export interface TokenStatusListTokenDto {
  sub: string;
  statusList: TokenStatusListDto;
}

export interface TrustMarkers {
  identityTrustMarker: boolean;
  compliantActorTrustMarker: boolean;
  governedUseCaseTrustMarker: boolean;
  governedUseCaseAuthorizationTrustMarker: boolean;
  transparentVerificationTrustMarker: boolean;
  isTrustedIssuer(): boolean;
  isTrustedVerifier(): boolean;
}

export interface TrustVerificationResult {
  resultId: string;
  actorDid: string;
  markers: TrustMarkers;
}

export interface UrlRestriction {
  allowedHosts: Set<string>;
}
