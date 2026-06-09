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
    verificationMethod: {
      id: string;
      type: string;
      publicKeyJwk: {
        kty: string;
        crv: string;
        x: string;
        y: string;
        kid: string;
      };
    }[];
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
