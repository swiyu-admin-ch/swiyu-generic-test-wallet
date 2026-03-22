export interface CredentialOffer {
  credential_issuer: string;
  credential_configuration_ids: string[];
  grants?: Record<string, GrantConfig>;
  version?: string;
}

export interface GrantConfig {
  "pre-authorized_code"?: string;
  user_pin?: string;
  [key: string]: unknown;
}
