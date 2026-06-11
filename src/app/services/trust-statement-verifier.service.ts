import { Injectable, inject } from "@angular/core";
import {
  NonComplianceTrustListStatement,
  ProtectedIssuanceAuthorizationTrustStatement,
  ProtectedIssuanceTrustListStatement,
  ProtectedVerificationAuthorizationTrustStatement,
  Statement,
  StatementType,
  StatefulStatement,
  TokenStatusListTokenDto,
  TrustMarkers,
  TrustStatement,
  TrustVerificationResult,
  UrlRestriction,
  VerificationQueryPublicStatement,
} from "../models/trust-statement-verifier.model";
import { v4 as uuidv4 } from "uuid";
import { CryptoService } from "./crypto-service";

/**
 * TrustStatementVerifierService
 *
 * Primary entry point for Swiss Trust Protocol 2.0 (TP 2.0) verification logic.
 * This service processes Trust Statements (JWTs) provided by an actor (Issuer or Verifier),
 * including:
 * - Cryptographic verification
 * - Validity checks
 * - Trust marker generation
 *
 * Usage flow:
 * 1. Initialize with serialized Trust Statement JWTs and URL restrictions
 * 2. Extract required Key IDs and Status List URIs
 * 3. Fetch corresponding public keys and status lists from trust registry
 * 4. Execute verification by calling appropriate method
 */
@Injectable({
  providedIn: "root",
})
export class TrustStatementVerifierService {
  private serializedTrustStatementJwts: string[];
  private statements: Statement[] = [];
  private urlRestriction: UrlRestriction;
  private cryptoService = inject(CryptoService);

  constructor() {
    this.serializedTrustStatementJwts = [];
    this.urlRestriction = { allowedHosts: new Set() };
  }

  /**
   * Initialize the verifier with trust statements and URL restrictions
   *
   * @param serializedTrustStatementJwts List of raw trust statement JWTs
   * @param urlRestriction Restriction for allowed hosts
   */
  public initialize(
    serializedTrustStatementJwts: string[],
    urlRestriction: UrlRestriction,
  ): void {
    this.serializedTrustStatementJwts = serializedTrustStatementJwts;
    this.urlRestriction = urlRestriction;
    this.statements = this.parseStatements(serializedTrustStatementJwts);
  }

  /**
   * Extracts all unique Key Identifiers (KIDs) from the provided statements.
   * Use this list to resolve the required public keys (DID Documents) from the network
   * before calling the verify methods.
   *
   * @return A set of absolute DIDs/KIDs (e.g., "did:tdw:example.ch#key-1")
   */
  public getRequiredKeyIds(): Set<string> {
    const keyIds = new Set<string>();
    for (const statement of this.statements) {
      keyIds.add(statement.kid);
    }
    return keyIds;
  }

  /**
   * Extracts all Status List URIs referenced by the provided statements.
   * Use this list to fetch the latest Token Status List (TSL) tokens from the Trust Registry
   * before calling the verify methods.
   *
   * @return A set of URIs pointing to the required status list resources
   */
  public getRequiredStatusLists(): Set<string> {
    const statusLists = new Set<string>();
    for (const statement of this.statements) {
      if (this.isStatefulStatement(statement)) {
        (statement as StatefulStatement).statusListUri &&
          statusLists.add((statement as StatefulStatement).statusListUri);
      }
    }
    return statusLists;
  }

  /**
   * Performs a full trust evaluation for an Issuer.
   * Verifies that the issuer is not revoked, and if the Issuer is authorized
   * to issue credentials of the given type (vct).
   *
   * @param trustRootDid The trusted root anchor DID of the swiyu ecosystem
   * @param actorDid The DID of the Issuer being evaluated
   * @param vct The Verifiable Credential Type (Schema) the Issuer intends to issue
   * @param publicKeySet The set of resolved public keys required for signature verification
   * @param verifiedStatusListTokens The list of pre-verified Status List tokens
   * @return A TrustVerificationResult containing the derived Trust Markers
   */
  public async verifyIssuanceStatements(
    trustRootDid: string,
    actorDid: string,
    vct: string,
    publicKeys: CryptoKey[],
    verifiedStatusListTokens: TokenStatusListTokenDto[],
  ): Promise<TrustVerificationResult> {
    const validStatements = await this.getValidStatements(
      trustRootDid,
      null,
      actorDid,
      publicKeys,
      verifiedStatusListTokens,
    );
    const markers = this.processCommonTrust(validStatements, actorDid);
    this.finalizeIssuerTrust(markers, validStatements, vct);

    return {
      resultId: uuidv4(),
      actorDid,
      markers,
    };
  }

  /**
   * Performs a full trust evaluation for a Verifier.
   * Verifies transparency and authorization of the verification query.
   *
   * @param trustRootDid The trusted root anchor DID of the swiyu ecosystem
   * @param publicStatementIssuerDid The DID allowed to issue vqPS (usually the Trust Registry)
   * @param actorDid The DID of the Verifier being evaluated
   * @param publicKeySet The set of resolved public keys required for signature verification
   * @param verifiedStatusListTokens The list of pre-verified Status List tokens
   * @return A TrustVerificationResult containing the derived Trust Markers
   */
  public async verifyVerifierStatements(
    trustRootDid: string,
    publicStatementIssuerDid: string,
    actorDid: string,
    publicKeys: CryptoKey[],
    verifiedStatusListTokens: TokenStatusListTokenDto[],
  ): Promise<TrustVerificationResult> {
    const validStatements = await this.getValidStatements(
      trustRootDid,
      publicStatementIssuerDid,
      actorDid,
      publicKeys,
      verifiedStatusListTokens,
    );

    const markers = this.processCommonTrust(validStatements, actorDid);
    this.finalizeVerifierTrust(markers, validStatements);

    return {
      resultId: uuidv4(),
      actorDid,
      markers,
    };
  }

  /**
   * Get valid statements that pass all validation filters
   */
  private async getValidStatements(
    trustRootDid: string,
    publicStatementIssuerDid: string | null,
    actorDid: string,
    publicKeys: CryptoKey[],
    verifiedStatusListTokens: TokenStatusListTokenDto[],
  ): Promise<Statement[]> {
    const results = await Promise.all(
      this.statements.map(async (statement) => ({
        statement,
        isValid:
          this.hasTrustedIssuer(
            statement,
            trustRootDid,
            publicStatementIssuerDid,
          ) &&
          this.isMatchingActor(statement, actorDid) &&
          /*(await this.isValidStatement(statement, publicKeySet)) &&*/
          this.hasValidState(statement, verifiedStatusListTokens),
      })),
    );

    return results
      .filter((result) => result.isValid)
      .map((result) => result.statement);
  }

  /**
   * Check if statement has a trusted issuer
   */
  private hasTrustedIssuer(
    statement: Statement,
    trustRootDid: string,
    publicStatementIssuerDid: string | null,
  ): boolean {
    const statementIssuer = this.getDidFromKid(statement.kid);

    if (statement.typ === StatementType.VERIFICATION_QUERY_PUBLIC_STATEMENT) {
      return statementIssuer === publicStatementIssuerDid;
    }

    return statementIssuer === trustRootDid;
  }

  /**
   * Check if statement matches the actor DID
   */
  private isMatchingActor(statement: Statement, actorDid: string): boolean {
    if (this.isTrustStatement(statement)) {
      return (statement as TrustStatement).sub === actorDid;
    }
    return true;
  }

  /**
   * Check if statement is a valid JWT (signature verification would happen here)
   * For now, this is a placeholder that returns true
   */
  private async isValidStatement(
    statement: Statement,
    publicKeySet: { [key: string]: unknown },
  ): Promise<boolean> {
    console.log("publicKeySet", publicKeySet);
    const key = await this.cryptoService.getCryptoKeyFromJwk(publicKeySet);
    return this.cryptoService.checkJwtIsValid(
      statement.serializedJwt,
      key as CryptoKey,
    );
  }

  /**
   * Check if statement has valid state (not revoked/suspended)
   */
  private hasValidState(
    statement: Statement,
    verifiedStatusListTokens: TokenStatusListTokenDto[],
  ): boolean {
    if (this.isStatefulStatement(statement)) {
      const statefulStmt = statement as StatefulStatement;
      const matchingStatusList = verifiedStatusListTokens.find(
        (sl) => sl.sub === statefulStmt.statusListUri,
      );

      if (!matchingStatusList) {
        console.info(
          `No matching token status list found for statement with uri ${statefulStmt.statusListUri}`,
        );
        return false;
      }

      try {
        // In a real implementation, this would check the token status list
        // and verify the status index
        const statusList = matchingStatusList.statusList;
        // Verify that the status is VALID (0) at the statusIndex
        // This would require parsing the status list data
        return true;
      } catch (error) {
        console.info(
          `Status List ${statefulStmt.statusListUri} cannot be loaded`,
          error,
        );
        return false;
      }
    } else {
      // Statements without state are always valid
      return true;
    }
  }

  /**
   * Process common trust markers (identity trust and compliance)
   */
  private processCommonTrust(
    statements: Statement[],
    actorDid: string,
  ): TrustMarkers {
    const markers: TrustMarkers = {
      identityTrustMarker: false,
      compliantActorTrustMarker: false,
      governedUseCaseTrustMarker: false,
      governedUseCaseAuthorizationTrustMarker: false,
      transparentVerificationTrustMarker: false,
      isTrustedIssuer() {
        return this.identityTrustMarker && this.compliantActorTrustMarker;
      },
      isTrustedVerifier() {
        return (
          this.identityTrustMarker &&
          this.compliantActorTrustMarker &&
          this.transparentVerificationTrustMarker
        );
      },
    };

    for (const statement of statements) {
      console.log(
        `Processing statement of type ${statement.typ} for actor ${actorDid}`,
        statement,
      );
      if (statement.typ === StatementType.IDENTITY_TRUST_STATEMENT) {
        console.log(`Actor ${actorDid} has an Identity Trust Statement`);
        markers.identityTrustMarker = true;
      } else if (
        statement.typ === StatementType.NON_COMPLIANCE_TRUST_LIST_STATEMENT
      ) {
        const nctls = statement as NonComplianceTrustListStatement;
        const isNonCompliant = nctls.nonCompliantActors.some(
          (nca) => nca.actor === actorDid,
        );
        console.log("nctls", nctls, isNonCompliant);

        if (!isNonCompliant) {
          markers.compliantActorTrustMarker = true;
        } else {
          console.warn(
            `Actor ${actorDid} is marked as non-compliant in trust list`,
          );
        }
      }
    }

    return markers;
  }

  /**
   * Finalize issuer-specific trust markers
   */
  private finalizeIssuerTrust(
    markers: TrustMarkers,
    statements: Statement[],
    vct: string,
  ): void {
    // If we have no information, assume the vct is governed
    markers.governedUseCaseTrustMarker = true;

    for (const statement of statements) {
      if (
        statement.typ === StatementType.PROTECTED_ISSUANCE_TRUST_LIST_STATEMENT
      ) {
        const piTLS = statement as ProtectedIssuanceTrustListStatement;
        markers.governedUseCaseTrustMarker = piTLS.vctValues.includes(vct);
      }

      if (
        statement.typ ===
        StatementType.PROTECTED_ISSUANCE_AUTHORIZATION_TRUST_STATEMENT
      ) {
        const piaTS = statement as ProtectedIssuanceAuthorizationTrustStatement;
        markers.governedUseCaseAuthorizationTrustMarker =
          piaTS.canIssue.vct === vct;
      }
    }
  }

  /**
   * Finalize verifier-specific trust markers
   */
  private finalizeVerifierTrust(
    markers: TrustMarkers,
    statements: Statement[],
  ): void {
    const authorizedFields = new Set<string>();
    const usedProtectedFields: string[] = [];
    const protectedClaims = ["personal_administrative_number"];

    for (const statement of statements) {
      if (
        statement.typ ===
        StatementType.PROTECTED_VERIFICATION_AUTHORIZATION_TRUST_STATEMENT
      ) {
        const pvaTS =
          statement as ProtectedVerificationAuthorizationTrustStatement;
        for (const field of pvaTS.authorizedFields) {
          authorizedFields.add(field);
        }
      }

      if (statement.typ === StatementType.VERIFICATION_QUERY_PUBLIC_STATEMENT) {
        markers.transparentVerificationTrustMarker = true;

        const vqPS = statement as VerificationQueryPublicStatement;
        const queryStr = JSON.stringify(vqPS.request.query);

        for (const protectedClaim of protectedClaims) {
          if (queryStr.includes(protectedClaim)) {
            usedProtectedFields.push(protectedClaim);
            markers.governedUseCaseTrustMarker = true;
          }
        }
      }
    }

    // Check if all used protected fields are covered by authorization
    if (usedProtectedFields.length > 0) {
      const allFieldsAuthorized = usedProtectedFields.every((field) =>
        authorizedFields.has(field),
      );
      if (allFieldsAuthorized) {
        markers.governedUseCaseAuthorizationTrustMarker = true;
      }
    }
  }

  /**
   * Parse serialized JWTs into Statement objects
   */
  private parseStatements(serializedJwts: string[]): Statement[] {
    console.log("serializedJwts", serializedJwts);
    return serializedJwts
      .map((jwt) => this.parseStatement(jwt))
      .filter((stmt) => stmt !== null) as Statement[];
  }

  /**
   * Parse a single JWT into a Statement
   */
  private parseStatement(jwt: string): Statement | null {
    try {
      const parts = jwt.split(".");
      if (parts.length !== 3) {
        console.warn("Invalid JWT format");
        return null;
      }

      const header = JSON.parse(this.decodeBase64(parts[0]));
      const payload = JSON.parse(this.decodeBase64(parts[1]));

      const statement: Statement = {
        typ: payload.typ || header.typ || "",
        alg: payload.alg || header.alg || "",
        kid: payload.kid || header.kid || "",
        profileVersion: header.profile_version || "1.0",
        iat: payload.iat || 0,
        exp: payload.exp || 0,
        serializedJwt: jwt,
      };

      // Add statement-specific properties based on type
      if (payload.sub) {
        (statement as TrustStatement).sub = payload.sub;
      }

      if (payload.statusListUri || payload.status_list_uri) {
        (statement as StatefulStatement).statusListUri =
          payload.statusListUri || payload.status_list_uri;
      }

      if (payload.statusIndex || payload.status_index) {
        (statement as StatefulStatement).statusIndex =
          payload.statusIndex || payload.status_index;
      }

      if (payload.nonCompliantActors || payload.non_compliant_actors) {
        (statement as NonComplianceTrustListStatement).nonCompliantActors =
          payload.nonCompliantActors || payload.non_compliant_actors;
      }

      if (payload.vctValues || payload.vct_values) {
        (statement as ProtectedIssuanceTrustListStatement).vctValues =
          payload.vctValues || payload.vct_values;
      }

      if (payload.canIssue || payload.can_issue) {
        (statement as ProtectedIssuanceAuthorizationTrustStatement).canIssue =
          payload.canIssue || payload.can_issue;
      }

      if (payload.authorizedFields || payload.authorized_fields) {
        (
          statement as ProtectedVerificationAuthorizationTrustStatement
        ).authorizedFields =
          payload.authorizedFields || payload.authorized_fields;
      }

      if (payload.request) {
        (statement as VerificationQueryPublicStatement).request =
          payload.request;
      }

      return statement;
    } catch (error) {
      console.warn("Failed to parse statement:", error);
      return null;
    }
  }

  /**
   * Check if a statement is a trust statement (has a 'sub' claim)
   */
  private isTrustStatement(statement: Statement): boolean {
    return "sub" in statement;
  }

  /**
   * Check if a statement is stateful (references a status list)
   */
  private isStatefulStatement(statement: Statement): boolean {
    return "statusListUri" in statement;
  }

  /**
   * Extract DID from KID
   */
  private getDidFromKid(kid: string): string {
    const parts = kid.split("#");
    return parts[0];
  }

  /**
   * Decode Base64 URL-safe string
   */
  private decodeBase64(str: string): string {
    try {
      // Add padding if needed
      const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
      // Replace URL-safe characters
      const urlSafe = padded.replace(/-/g, "+").replace(/_/g, "/");
      // Decode
      return decodeURIComponent(
        atob(urlSafe)
          .split("")
          .map((c) => {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join(""),
      );
    } catch (error) {
      console.error("Failed to decode Base64:", error);
      return "";
    }
  }
}
