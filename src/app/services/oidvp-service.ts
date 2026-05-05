import { HttpClient, HttpHeaders, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { CompactEncrypt, importJWK } from "jose";
import { from, map, Observable, of, switchMap } from "rxjs";
import { VpTokenMap } from "@app/models/api-response";
import { RequestObject } from "src/generated/verifier";

@Injectable({
  providedIn: "root",
})
export class OIDVPService {
  private http = inject(HttpClient);

  fetchRequestObject(requestObjectUrl: string): Observable<RequestObject | string> {
    if (!requestObjectUrl) {
      throw new Error("requestObjectUrl is required");
    }

    return this.http.get(requestObjectUrl, { responseType: "text" }).pipe(
      map((response: string) => {
        try {
          return JSON.parse(response) as RequestObject;
        } catch {
          return response;
        }
      })
    );
  }

  submitVerificationResponse(
    requestObject: RequestObject,
    vpToken: string,
    credentialId = "credential_1"
  ): Observable<string> {
    if (!requestObject?.response_uri) {
      throw new Error("No response_uri provided in request object");
    }

    if (!vpToken?.trim()) {
      throw new Error("VP token is empty or undefined");
    }

    const vpTokenMap: VpTokenMap = {
      [credentialId]: [vpToken],
    };

    return this.preparePayload(requestObject, JSON.stringify(vpTokenMap)).pipe(
      switchMap(({ body, headers }) =>
        this.http.post(requestObject.response_uri!, body.toString(), {
          headers,
          responseType: "text",
        })
      )
    );
  }

  private preparePayload(
    requestObject: RequestObject,
    vpTokenJson: string
  ): Observable<{ body: HttpParams; headers: HttpHeaders }> {
    const headers = new HttpHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
      "SWIYU-API-Version": "2",
    });

    if (requestObject.response_mode === "direct_post.jwt") {
      return from(this.encryptVerifierPayload(requestObject, vpTokenJson)).pipe(
        map((encryptedPayload: string) => ({
          body: new HttpParams().set("response", encryptedPayload),
          headers,
        }))
      );
    }

    return of({
      body: new HttpParams().set("vp_token", vpTokenJson),
      headers,
    });
  }

  private async encryptVerifierPayload(
    requestObject: RequestObject,
    vpTokenJson: string
  ): Promise<string> {
    const encryptionKey = requestObject.client_metadata?.jwks?.keys?.[0];

    if (!encryptionKey) {
      throw new Error("No encryption key available in client_metadata.jwks.keys");
    }

    if (!encryptionKey.alg || !encryptionKey.kty) {
      throw new Error("Invalid JWK: missing alg or kty properties");
    }

    const encryptionEnc = requestObject.client_metadata?.encrypted_response_enc_values_supported?.[0];
    if (!encryptionEnc) {
      throw new Error("No encryption algorithm specified in encrypted_response_enc_values_supported");
    }

    let vpToken: unknown;
    try {
      vpToken = JSON.parse(vpTokenJson);
    } catch (error) {
      throw new Error(`Invalid vp_token JSON format: ${(error as Error).message}`);
    }

    const publicKey = await importJWK(encryptionKey, encryptionKey.alg);
    const payload = new TextEncoder().encode(JSON.stringify({ vp_token: vpToken }));

    return new CompactEncrypt(payload)
      .setProtectedHeader({
        alg: encryptionKey.alg,
        enc: encryptionEnc,
        typ: "JWT",
        kid: encryptionKey.kid || undefined,
      })
      .encrypt(publicKey);
  }
}
