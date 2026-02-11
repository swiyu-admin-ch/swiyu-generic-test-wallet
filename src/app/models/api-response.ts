/**
 * Generic API Response types
 * Used for responses that don't have specific generated types
 */

export type OpenIdMetadataResponse = Record<string, unknown>;

export type OpenIdConfigResponse = Record<string, unknown>;

export type JwtPayload = Record<string, unknown>;

export type CredentialResponse = Record<string, unknown>;

export type RegistryEntry = Record<number, unknown>;

export type PresentationSubmission = Record<string, unknown>;

export type VpTokenMap = Record<string, string[]>;

