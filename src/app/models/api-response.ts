import { OpenIdIssuerMetadata } from "./open-id-issuer-metadata";

export type OpenIdMetadataResponse = OpenIdIssuerMetadata;

export type OpenIdConfigResponse = Record<string, unknown>;

export type JwtPayload = Record<string, unknown>;

export type CredentialResponse = Record<string, unknown>;

export type RegistryEntry = Record<number, unknown>;

export type PresentationSubmission = Record<string, unknown>;

export type VpTokenMap = Record<string, string[]>;

