export interface DidResponse {
  versionId: string;
  versionTime: string;
  parameters: {
    method: string;
    scid: string;
    updateKeys: string[];
    portable: boolean;
  };
  state: {
    "@context": string[];
    id: string;
    authentication: string[];
    assertionMethod: string[];
    verificationMethod: VerificationMethod[];
    proof: {
      type: string;
      cryptosuite: string;
      created: string;
      verificationMethod: string;
      proofPurpose: string;
      proofValue: string;
    }[];
  };
}

export interface VerificationMethod {
  id: string;
  type: string;
  publicKeyJwk: PublicKeyJwk;
}

export interface PublicKeyJwk {
  kty: string;
  crv: string;
  x: string;
  y: string;
  kid: string;
}
