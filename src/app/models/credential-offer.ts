/**
 * Represents a credential offer from a swiyu:// deeplink
 */
export interface CredentialOffer {
  /**
   * The credential issuer URL
   */
  credential_issuer: string;

  /**
   * Array of credential configuration IDs that are being offered
   */
  credential_configuration_ids: string[];

  /**
   * Grant types and their configurations
   * Typically includes pre-authorized code grant
   */
  grants?: Record<string, GrantConfig>;

  /**
   * Version of the credential offer specification
   */
  version?: string;
}

/**
 * Configuration for a specific grant type
 */
export interface GrantConfig {
  /**
   * Pre-authorized code for pre-authorized code flow
   */
  "pre-authorized_code"?: string;

  /**
   * User PIN for pre-authorized code flow
   */
  user_pin?: string;

  /**
   * Additional grant-specific configuration
   */
  [key: string]: unknown;
}

