import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { StatementType } from "@app/models/trust-statement-verifier.model";
import { HolderKeyService } from "@app/services/holder-key.service";
import { TrustService } from "@app/services/trust-service";
import { base64url, compactDecrypt, decodeJwt, exportJWK, generateKeyPair } from "jose";
import { EMPTY, of } from "rxjs";
import { DcqlQueryDto, RequestObject } from "src/generated/verifier";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CredentialVerification } from "./credential-verification";

describe("Credential verification DCQL resolution", () => {
  const requestUri = "https://verifier.example/request";
  const responseUri = "https://verifier.example/response";
  const verifierDid = "did:webvh:test:registry.example:verifier";
  const clientId = `decentralized_identifier:${verifierDid}`;
  const scope = "example.identity";
  const query: DcqlQueryDto = {
    credentials: [
      { id: "identity", format: "dc+sd-jwt", meta: { vct_values: ["example-id"] } },
    ],
  };
  const idTS = statement(StatementType.IDENTITY_TRUST_STATEMENT, {
    sub: verifierDid,
  });
  const pvaTS = statement(
    StatementType.PROTECTED_VERIFICATION_AUTHORIZATION_TRUST_STATEMENT,
    { sub: verifierDid, authorized_fields: ["family_name"] },
  );
  const vqPS = statement(StatementType.VERIFICATION_QUERY_PUBLIC_STATEMENT, {
    sub: verifierDid,
    request: { type: "DCQL", scope, query },
  });
  const getVerificationTrustStatements = vi.fn();

  let http: HttpTestingController;
  let verification: CredentialVerification;

  beforeEach(() => {
    getVerificationTrustStatements.mockReset().mockReturnValue(EMPTY);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TrustService, useValue: { getVerificationTrustStatements } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    verification = TestBed.runInInjectionContext(() => new CredentialVerification());
    verification.credentialInput.set(`${compactJwt("dc+sd-jwt", { vct: "example-id" })}~`);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  it("uses the scoped vqPS following an idTS and pvaTS to submit a presentation", async () => {
    // Use the same Uint8Array constructor as TextEncoder in the jsdom environment.
    vi.stubGlobal("Uint8Array", new TextEncoder().encode("").constructor);
    const holder = TestBed.inject(HolderKeyService);
    await holder.initializeKeys();
    const encryptionKeys = await generateKeyPair("ECDH-ES");
    const encryptionJwk = await exportJWK(encryptionKeys.publicKey);
    getVerificationTrustStatements.mockReturnValue(
      of({ pvaTLS: null, vqPS: null, ncTLS: null }),
    );

    resolve({
      scope: `another.scope ${scope}`,
      verifier_info: [idTS, pvaTS, vqPS],
      response_mode: "direct_post.jwt",
      client_metadata: {
        jwks: { keys: [{ ...encryptionJwk, alg: "ECDH-ES" }] },
        encrypted_response_enc_values_supported: ["A256GCM"],
      },
    });

    expect(verification.dcql()?.query).toEqual(query);
    expect(verification.trustStatements()?.vqPS).toBe(vqPS.data);
    expect(verification.idTSMatchesClientId()).toBe(true);
    expect(getVerificationTrustStatements).toHaveBeenCalledWith(verifierDid);
    http.expectOne("https://registry.example/verifier/did.jsonl").flush({
      state: { verificationMethod: [{ publicKeyJwk: holder.getJwk() }] },
    });

    const response = await vi.waitFor(() => {
      expect(verification.token()?.error).toBeUndefined();
      expect(verification.verification()?.error).toBeUndefined();
      return http.expectOne(responseUri);
    });
    expect(response.request.method).toBe("POST");
    const encryptedPayload = new URLSearchParams(response.request.body).get("response")!;
    const { plaintext } = await compactDecrypt(encryptedPayload, encryptionKeys.privateKey);
    const vpToken: Record<string, string[]> = JSON.parse(
      new TextDecoder().decode(plaintext),
    ).vp_token;
    expect(Object.keys(vpToken)).toEqual(["identity"]);
    expect(decodeJwt(vpToken["identity"][0].split("~").at(-1)!)).toMatchObject({
      aud: clientId,
      nonce: "test-nonce",
    });
    response.flush("OK");
    expect(verification.verification()?.submitted).toBe(true);
  });

  it("keeps resolving requests with a direct dcql_query", () => {
    resolve({ dcql_query: query });

    expect(verification.dcql()?.query).toEqual(query);
    expect(verification.requiredCredentials()).toEqual(query.credentials);
  });

  it("reports an unmatched scope before attempting a presentation", () => {
    resolve({ scope: `${scope}.different`, verifier_info: [idTS, pvaTS, vqPS] });

    expect(verification.dcql()?.error).toMatchObject({
      message: "No vqPS in verifier_info matches the request scope",
    });
    expect(getVerificationTrustStatements).not.toHaveBeenCalled();
  });

  it("reports a matching vqPS without a DCQL query", () => {
    resolve({
      scope,
      verifier_info: [
        idTS,
        statement(StatementType.VERIFICATION_QUERY_PUBLIC_STATEMENT, {
          sub: verifierDid,
          request: { type: "DCQL", scope },
        }),
      ],
    });

    expect(verification.dcql()?.error).toMatchObject({
      message: "The matching vqPS does not contain a DCQL query",
    });
  });

  function resolve(request: RequestObject): void {
    verification.onResolve(requestUri);
    http.expectOne(requestUri).flush(
      compactJwt("oauth-authz-req+jwt", {
        client_id: clientId,
        iss: clientId,
        nonce: "test-nonce",
        response_uri: responseUri,
        ...request,
      }),
    );
  }

  function statement(typ: StatementType, payload: object) {
    return { format: "jwt", data: compactJwt(typ, payload) };
  }

  function compactJwt(typ: string, payload: object): string {
    const header = base64url.encode(JSON.stringify({ typ, alg: "ES256" }));
    return `${header}.${base64url.encode(JSON.stringify(payload))}.test-signature`;
  }
});
