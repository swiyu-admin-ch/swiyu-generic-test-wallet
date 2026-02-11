import { IssuerCredentialRequestEncryption, IssuerCredentialResponseEncryption } from "src/generated/issuer";

export interface OpenIdIssuerMetadata {
  credential_issuer?: string;
  credential_endpoint?: string;
  nonce_endpoint?: string;

  credential_request_encryption?: IssuerCredentialRequestEncryption;
  credential_response_encryption?: IssuerCredentialResponseEncryption;

  credential_configurations_supported?: Record<
    string,
    unknown
  >;

  batch_credential_issuance?: {
    batch_size: number;
  };

  version?: string;
}
