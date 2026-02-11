import { inject, Injectable } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from "@angular/common/http";
import { catchError, Observable, throwError, map, switchMap, from, of } from "rxjs";
import { CompactEncrypt, importJWK } from "jose";
import { NonceResponse, OAuthToken } from "src/generated/issuer";
import {
  OpenIdMetadataResponse,
  OpenIdConfigResponse,
  JwtPayload,
  CredentialResponse,
  PresentationSubmission,
  VpTokenMap,
  RegistryEntry
} from "@app/models/api-response";
import { RequestObject } from "src/generated/verifier";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  private http = inject(HttpClient)

  public resolveOpenIdMetadataFromDeeplink(
    issuerCredentialUrl: string
  ): Observable<OpenIdMetadataResponse> {
    return this.http
      .get<OpenIdMetadataResponse>(`${issuerCredentialUrl}/.well-known/openid-credential-issuer`, {
        responseType: "json",
      })
      .pipe(catchError(this.handleError));
  }

  public resolveOpenIdConfigMetadataFromDeeplink(
    issuerCredentialUrl: string
  ): Observable<OpenIdConfigResponse> {
    if (!issuerCredentialUrl) {
      return throwError(() => new Error("No issuer_credential_url provided"));
    }

    return this.http
      .get<OpenIdConfigResponse>(`${issuerCredentialUrl}/.well-known/openid-configuration`, {
        responseType: "json",
      })
      .pipe(catchError(this.handleError));
  }

  public resolveRequestObjectFromDeeplink(
    verifierRequestObjectUrl: string
  ): Observable<JwtPayload> {
    if (!verifierRequestObjectUrl) {
      return throwError(() => new Error("No verifier request object URL provided"));
    }

    return (this.http
      .get(`${verifierRequestObjectUrl}`, {
        responseType: "text",
      }) as Observable<string>)
      .pipe(
        map((response: string): JwtPayload => {
          try {
            return JSON.parse(response) as JwtPayload;
          } catch (error) {
            console.log(error);
            return this.decodeJwtPayload(response);
          }
        }),
        catchError(this.handleError)
      );
  }

  private decodeJwtPayload(token: string): JwtPayload {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format");
      }

      const payload = parts[1];
      const decoded = atob(payload);
      return JSON.parse(decoded) as JwtPayload;
    } catch (error) {
      throw new Error(`Failed to decode JWT payload: ${error}`);
    }
  }

  public getAccessToken(preAuthCode: string, tokenEndpointUrl: string): Observable<OAuthToken> {
    if (!preAuthCode || !tokenEndpointUrl) {
      return throwError(() => new Error("No pre-authorized code provided"));
    }

    const body = new HttpParams()
      .set("grant_type", "urn:ietf:params:oauth:grant-type:pre-authorized_code")
      .set("pre-authorized_code", preAuthCode);

    return this.http
      .post<OAuthToken>(tokenEndpointUrl, body.toString(), {
        responseType: "json",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
      .pipe(catchError((err: HttpErrorResponse) => this.handleError(err)));
  }

  public getNonce(nonceEndpoint: string): Observable<NonceResponse> {
    if (!nonceEndpoint) {
      return throwError(() => new Error("No nonce_endpoint provided"));
    }

    return this.http
      .post<NonceResponse>(`${nonceEndpoint}`, {},
        {
        responseType: "json",
      })
      .pipe(catchError(this.handleError));
  }

  public getCredential(
    issuerCredentialUrl: string,
    bearerToken: string,
    payload: CredentialResponse
  ): Observable<CredentialResponse> {
    if (!issuerCredentialUrl) {
      return throwError(() => new Error("No issuer_credential_url provided"));
    }

    return this.http
      .post<CredentialResponse>(issuerCredentialUrl, payload, {
        responseType: "json",
        headers: { Authorization: `Bearer ${bearerToken}` },
      })
      .pipe(catchError(this.handleError));
  }

  public getCredentialV2(
    issuerCredentialUrl: string,
    bearerToken: string,
    payload: CredentialResponse
  ): Observable<CredentialResponse> {
    if (!issuerCredentialUrl) {
      return throwError(() => new Error("No issuer_credential_url provided"));
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${bearerToken}`,
      "SWIYU-API-Version": "2",
    });

    return this.http
      .post<CredentialResponse>(issuerCredentialUrl, payload, {
        responseType: "json",
        headers: headers,
      })
      .pipe(catchError(this.handleError));
  }

  public getRegistryEntry(registryEntryUrl: string): Observable<RegistryEntry[]> {
    const url = this.getRegistryEntryLocation(registryEntryUrl);
    return this.http.get<RegistryEntry[]>(url).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error(error);
    return throwError(() => new Error("An error occurred while fetching data"));
  }

  private getRegistryEntryLocation(iss: string): string {
    const parts = iss.split(":");

    return `https://${decodeURIComponent(
      iss.substring(iss.indexOf(parts[3]), iss.length).replace(/:/g, "/")
    )}/did.jsonl`;
  }

  public submitVerificationResponse(
    responseDataUri: string,
    vpToken: string,
    presentationSubmission: PresentationSubmission
  ): Observable<string> {
    if (!responseDataUri) {
      return throwError(() => new Error("No response_uri provided"));
    }

    const body = new HttpParams()
      .set("presentation_submission", JSON.stringify(presentationSubmission))
      .set("vp_token", vpToken);

    const headers = new HttpHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
      "SWIYU-API-Version": "1"
    });

    return this.http
      .post(responseDataUri, body.toString(), {
        headers: headers,
        responseType: "text"
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error("Error submitting verification response:", error);
          return throwError(() => new Error("Failed to submit verification response"));
        })
      );
  }

  private prepareDcqlPayload(
    requestObject: RequestObject,
    vpTokenJson: string
  ): Observable<{ body: HttpParams; headers: HttpHeaders }> {
    const headers = new HttpHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
      "SWIYU-API-Version": "2",
    });

    if (requestObject.response_mode === "direct_post.jwt") {
      return from(this.encryptVerifierPayload(requestObject, vpTokenJson)).pipe(
        map((encryptedPayload: string) => {
          const body = new HttpParams().set("response", encryptedPayload);
          return { body, headers };
        }),
        catchError((error: Error) =>
          throwError(() => new Error(`JWE encryption failed: ${error.message}`))
        )
      );
    }

    const body = new HttpParams().set("vp_token", vpTokenJson);
    return of({ body, headers });
  }

  public submitVerificationResponseDcql(
    requestObject: RequestObject,
    vpToken: string,
    credentialId = "credential_1"
  ): Observable<string> {
    if (!requestObject?.response_uri) {
      return throwError(() => new Error("No response_uri provided in request_object"));
    }

    if (!vpToken?.trim()) {
      return throwError(() => new Error("VP token is empty or undefined"));
    }

    const vpTokenMap: VpTokenMap = {};
    vpTokenMap[credentialId] = [vpToken];
    const vpTokenJson = JSON.stringify(vpTokenMap);

    return this.prepareDcqlPayload(requestObject, vpTokenJson).pipe(
      switchMap(({ body, headers }) => {
        console.debug("Submitting DCQL verification response", {
          endpoint: requestObject.response_uri,
          responseMode: requestObject.response_mode,
          credentialId,
        });

        return this.http.post(requestObject.response_uri!, body.toString(), {
          headers,
          responseType: "text",
        });
      }),

      catchError((error: HttpErrorResponse | Error) => {
        let errorMsg: string;

        if (error instanceof HttpErrorResponse) {
          errorMsg = `DCQL submission failed (HTTP ${error.status}): ${error.message}`;
          if (error.error) {
            errorMsg += ` - Server response: ${error.error}`;
          }
        } else {
          errorMsg = `DCQL submission failed: ${error.message}`;
        }

        console.error(errorMsg, { error, requestObject });
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  public async encryptVerifierPayload(
    requestObject: RequestObject,
    vpTokenJson: string
  ): Promise<string> {
    try {
      if (!requestObject?.client_metadata?.jwks?.keys?.length) {
        throw new Error(
          "No encryption key available in client_metadata.jwks.keys"
        );
      }

      const encryptionKey = requestObject.client_metadata.jwks.keys[0];

      if (!encryptionKey.alg || !encryptionKey.kty) {
        throw new Error("Invalid JWK: missing alg or kty properties");
      }

      if (!requestObject.client_metadata.encrypted_response_enc_values_supported?.length) {
        throw new Error("No encryption algorithm specified in encrypted_response_enc_values_supported");
      }

      const encryptionAlg = encryptionKey.alg;
      const encryptionEnc = requestObject.client_metadata.encrypted_response_enc_values_supported[0]; // Ex: A128GCM

      const publicKey = await importJWK(encryptionKey, encryptionAlg);

      let vpTokenObj: Record<string, unknown>;
      try {
        vpTokenObj = JSON.parse(vpTokenJson);
      } catch (e) {
        throw new Error(`Invalid vp_token JSON format: ${(e as Error).message}`);
      }

      const payloadToEncrypt = {
        vp_token: vpTokenObj
      };
      const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadToEncrypt));

      const encryptedJwe = await new CompactEncrypt(payloadBytes)
        .setProtectedHeader({
          alg: encryptionAlg,
          enc: encryptionEnc,
          typ: "JWT",
          kid: encryptionKey.kid || undefined,
        })
        .encrypt(publicKey);

      console.debug("VP token encrypted successfully", {
        algorithm: encryptionAlg,
        encryptionMethod: encryptionEnc,
        keyId: encryptionKey.kid
      });

      return encryptedJwe;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown encryption error";
      console.error("Encryption failed:", {
        error,
        hasClientMetadata: !!requestObject?.client_metadata,
        hasKeys: !!requestObject?.client_metadata?.jwks?.keys?.length,
        hasEncAlgs: !!requestObject?.client_metadata?.encrypted_response_enc_values_supported?.length
      });
      throw new Error(`Failed to encrypt verifier payload: ${errorMessage}`);
    }
  }
}
