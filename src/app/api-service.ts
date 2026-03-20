import { inject, Injectable } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from "@angular/common/http";
import { catchError, Observable, throwError, map, switchMap, from, of, tap } from "rxjs";
import { CompactEncrypt, importJWK, compactDecrypt, CompactJWEHeaderParameters, generateKeyPair, GenerateKeyPairOptions, JWK } from "jose";
import { IssuerCredentialRequestEncryption, IssuerCredentialResponseEncryption, NonceResponse, OAuthToken } from "src/generated/issuer";
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
import { JWKS } from "@models/jwks"
import { WalletOptionsService } from "@services/wallet-options.service";
import { MetadataSignatureTrackingService } from "@services/metadata-signature-tracking.service";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  private http = inject(HttpClient);
  private walletOptionsService = inject(WalletOptionsService);
  private metadataSignatureTrackingService = inject(MetadataSignatureTrackingService);
  private ephemeralPrivateKey?: CryptoKey;

  public setResponseDecryptionKey(key: CryptoKey) {
    this.ephemeralPrivateKey = key;
  }

  public resolveOpenIdMetadataFromDeeplink(
    issuerCredentialUrl: string
  ): Observable<OpenIdMetadataResponse> {
    const walletOptions = this.walletOptionsService.getOptions();
    const useSignedMetadata = walletOptions.useSignedMetadata;

    if (useSignedMetadata) {
      // Request signed metadata as JWT
      return (this.http
        .get(`${issuerCredentialUrl}/.well-known/openid-credential-issuer`, {
          responseType: "text",
          headers: new HttpHeaders({
            "Accept": "application/jwt"
          })
        }) as Observable<string>)
        .pipe(
          map((jwt: string) => {
            try {
              // Decode JWT payload to get the metadata
              const rawMetadata = this.decodeJwtPayload(jwt) as OpenIdMetadataResponse;
              this.metadataSignatureTrackingService.setOpenIdMetadataIsSigned(true);
              return rawMetadata;
            } catch (error) {
              throw new Error(`Failed to decode signed metadata JWT: ${error}`);
            }
          }),
          catchError((error) => this.handleError(error, `${issuerCredentialUrl}/.well-known/openid-credential-issuer`))
        );
    } else {
      // Request unsigned metadata as JSON
      return this.http
        .get<OpenIdMetadataResponse>(`${issuerCredentialUrl}/.well-known/openid-credential-issuer`, {
          responseType: "json",
          headers: new HttpHeaders({
            "Accept": "application/json"
          })
        })
        .pipe(
          tap(() => this.metadataSignatureTrackingService.setOpenIdMetadataIsSigned(false)),
          catchError((error) => this.handleError(error, `${issuerCredentialUrl}/.well-known/openid-credential-issuer`))
        );
    }
  }

  public resolveOpenIdConfigMetadataFromDeeplink(
    issuerCredentialUrl: string
  ): Observable<OpenIdConfigResponse> {
    if (!issuerCredentialUrl) {
      return throwError(() => new Error("No issuer_credential_url provided"));
    }

    const walletOptions = this.walletOptionsService.getOptions();
    const useSignedMetadata = walletOptions.useSignedMetadata;

    if (useSignedMetadata) {
      // Request signed metadata as JWT
      return (this.http
        .get(`${issuerCredentialUrl}/.well-known/openid-configuration`, {
          responseType: "text",
          headers: new HttpHeaders({
            "Accept": "application/jwt"
          })
        }) as Observable<string>)
        .pipe(
          map((jwt: string) => {
            try {
              // Decode JWT payload to get the metadata
              const rawMetadata = this.decodeJwtPayload(jwt) as OpenIdConfigResponse;
              this.metadataSignatureTrackingService.setOpenIdConfigMetadataIsSigned(true);
              return rawMetadata;
            } catch (error) {
              throw new Error(`Failed to decode signed metadata JWT: ${error}`);
            }
          }),
          catchError((error) => this.handleError(error, `${issuerCredentialUrl}/.well-known/openid-configuration`))
        );
    } else {
      // Request unsigned metadata as JSON
      return this.http
        .get<OpenIdConfigResponse>(`${issuerCredentialUrl}/.well-known/openid-configuration`, {
          responseType: "json",
          headers: new HttpHeaders({
            "Accept": "application/json"
          })
        })
        .pipe(
          tap(() => this.metadataSignatureTrackingService.setOpenIdConfigMetadataIsSigned(false)),
          catchError((error) => this.handleError(error, `${issuerCredentialUrl}/.well-known/openid-configuration`))
        );
    }
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
            console.error(error);
            return this.decodeJwtPayload(response);
          }
        }),
        catchError((error) => this.handleError(error, verifierRequestObjectUrl))
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
      .pipe(catchError((error) => this.handleError(error, tokenEndpointUrl)));
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
      .pipe(catchError((error) => this.handleError(error, nonceEndpoint)));
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
      .pipe(catchError((error) => this.handleError(error, issuerCredentialUrl)));
  }

  public getCredentialV2(
    metadata: OpenIdMetadataResponse,
    bearerToken: string,
    payload: CredentialResponse
  ): Observable<any> {

    const issuerCredentialUrl = metadata.credential_endpoint as string;

    if (!issuerCredentialUrl) {
      return throwError(() => new Error("No issuer_credential_url provided"));
    }

    const requestEncryption =
      metadata.credential_request_encryption as IssuerCredentialRequestEncryption;

    const isEncrypted = requestEncryption?.encryption_required === true;

    return from(
      this.prepareCredentialRequest(payload, requestEncryption)
    ).pipe(
      switchMap((preparedPayload) => {

        let headers = new HttpHeaders({
          Authorization: `Bearer ${bearerToken}`,
          "SWIYU-API-Version": "2",
        });

        if (isEncrypted) {
          headers = headers.set("Content-Type", "application/jwt");

          return this.http.post<string>(
            issuerCredentialUrl,
            preparedPayload,
            {
              headers,
              responseType: 'text' as any
            }
          )
        } else {
          headers = headers.set("Content-Type", "application/json");

          return this.http.post<CredentialResponse>(
            issuerCredentialUrl,
            preparedPayload,
            {
              headers,
              responseType: "json",
            }
          );
        }
      }),
      catchError((error: HttpErrorResponse | Error) => {
        const errorMsg =
          error instanceof HttpErrorResponse
            ? `Credential fetch failed (HTTP ${error.status}): ${error.message}`
            : `Credential fetch failed: ${error.message}`;

        console.error(errorMsg);
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  private async prepareCredentialRequest(
    payload: CredentialResponse,
    requestEncryption?: IssuerCredentialRequestEncryption
  ): Promise<CredentialResponse | string> {

    if (!requestEncryption?.encryption_required) {
      return payload;
    }

    try {

      const jwks = requestEncryption.jwks as JWKS | undefined;
      const keys = jwks?.keys;

      if (!Array.isArray(keys) || keys.length === 0) {
        throw new Error(
          "No encryption keys available in credential_request_encryption.jwks.keys"
        );
      }

      const encKey = keys[0];

      const encAlg = encKey.alg ?? "ECDH-ES";
      const encEnc = requestEncryption.enc_values_supported?.[0];
      const zipSupported = requestEncryption.zip_values_supported?.[0];

      if (!encEnc) {
        throw new Error(
          "No supported encryption value provided in enc_values_supported"
        );
      }

      if (!encKey.kid) {
        throw new Error("Encryption key is missing required 'kid'");
      }

      if (!encKey.crv) {
        throw new Error("Encryption key is missing required 'crv'");
      }

      const recipientPublicKey = await importJWK(encKey, encAlg);

      const plaintext = new TextEncoder().encode(JSON.stringify(payload));

      const protectedHeader: CompactJWEHeaderParameters = {
        alg: encAlg,
        enc: encEnc,
        typ: "JWT",
        kid: encKey.kid,
        ...(zipSupported ? { zip: zipSupported } : {})
      };

      const encryptedJwe = await new CompactEncrypt(plaintext)
        .setProtectedHeader(protectedHeader)
        .encrypt(recipientPublicKey);

      return encryptedJwe;

    } catch (error) {

      const errorMessage =
        error instanceof Error ? error.message : "Unknown encryption error";

      console.error("Credential request encryption failed:", error);

      throw new Error(`Failed to encrypt credential request: ${errorMessage}`);
    }
  }

  public async processCredentialResponse(
    response: CredentialResponse | string,
    responseEncryption?: IssuerCredentialResponseEncryption,
    isEncrypted = false
  ): Promise<CredentialResponse> {

    if (!responseEncryption?.encryption_required && !isEncrypted) {
      return response as CredentialResponse;
    }

    try {
      const credentialResponseJwe = response as string;

      if (!this.ephemeralPrivateKey) {
        throw new Error("Missing wallet ephemeral private key. Cannot decrypt credential response.");
      }

      const { plaintext, protectedHeader } = await compactDecrypt(
        credentialResponseJwe,
        this.ephemeralPrivateKey
      );

      const decryptedPayload = JSON.parse(new TextDecoder().decode(plaintext)) as CredentialResponse;

      console.debug("Credential response decrypted successfully", protectedHeader);
      return decryptedPayload;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown decryption error";
      console.error("Credential response decryption failed:", error);
      throw new Error(`Failed to decrypt credential response: ${errorMessage}`);
    }
  }

  public getRegistryEntry(registryEntryUrl: string): Observable<RegistryEntry[]> {
    const url = this.getRegistryEntryLocation(registryEntryUrl);
    return this.http.get<RegistryEntry[]>(url).pipe(catchError((error) => this.handleError(error, url)));
  }

  private handleError(error: HttpErrorResponse | Error, url?: string): Observable<never> {
    console.error(error);

    return throwError(() => error);
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
      const encryptionEnc = requestObject.client_metadata.encrypted_response_enc_values_supported[0];

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
