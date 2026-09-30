export interface CredentialOffer {
  credential_issuer: string;
  credential_configuration_ids: string[];
  grants?: Record<string, GrantConfig>;
  version?: string;
}

export interface GrantConfig {
  "pre-authorized_code"?: string;
  tx_code?: TransactionCode;
  user_pin?: string;
  [key: string]: unknown;
}

export interface TransactionCode {
  input_mode?: "numeric" | "text";
  length?: number;
  description?: string;
}
