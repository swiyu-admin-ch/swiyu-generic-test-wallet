import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
  HttpResponse,
} from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import {
  OpenIdConfigResponse,
  OpenIdMetadataResponse,
  RegistryEntry,
} from "@app/models/api-response";
import { Observable, catchError, from, map, switchMap, throwError } from "rxjs";
import { CredentialEndpointResponse } from "src/generated/issuer";
import { NonceResponse } from "src/generated/issuer/model/nonceResponse";
import { OAuthToken } from "src/generated/issuer/model/oAuthToken";
import { DpopService } from "./dpop-service";
import { DpopKeyPair } from "./vc-key-store.service";
import { DidResponse } from "@app/models/did-response";

@Injectable({
  providedIn: "root",
})
export class OIDVCIService {
  private http = inject(HttpClient);

  private static readonly DPOP_NONCE_HEADER = "DPoP-Nonce";
  private static readonly ISSUER_METADATA_PATH =
    "/.well-known/openid-credential-issuer";
  private static readonly OPENID_CONFIGURATION_PATH =
    "/.well-known/openid-configuration";

  private dpopService = inject(DpopService);

  fetchIssuerMetadata(
    issuerUrl: string,
    signed = false,
  ): Observable<OpenIdMetadataResponse | string> {
    if (!issuerUrl) {
      throw new Error("issuerUrl is required");
    }

    const url = `${issuerUrl}${OIDVCIService.ISSUER_METADATA_PATH}`;

    if (signed) {
      return this.http.get(url, {
        responseType: "text",
        headers: new HttpHeaders({
          Accept: "application/jwt",
        }),
      });
    }

    return this.http.get<OpenIdMetadataResponse>(url, {
      headers: new HttpHeaders({
        Accept: "application/json",
      }),
    });
  }

  fetchOpenIdConfiguration(
    issuerUrl: string,
    signed = false,
  ): Observable<OpenIdConfigResponse | string> {
    const url = `${issuerUrl}${OIDVCIService.OPENID_CONFIGURATION_PATH}`;

    if (signed) {
      return this.http.get(url, {
        responseType: "text",
        headers: new HttpHeaders({
          Accept: "application/jwt",
        }),
      });
    }

    return this.http.get<OpenIdConfigResponse>(url, {
      headers: new HttpHeaders({
        Accept: "application/json",
      }),
    });
  }

  fetchAccessToken(
    tokenEndpointUrl: string,
    nonceEndpointUrl: string,
    preAuthCode: string,
    dpopKeys?: DpopKeyPair,
    transactionCode?: string,
  ): Observable<OAuthToken> {
    if (!preAuthCode || !tokenEndpointUrl) {
      throw new Error("Missing pre-authorized code or token endpoint");
    }

    let body = new HttpParams()
      .set("grant_type", "urn:ietf:params:oauth:grant-type:pre-authorized_code")
      .set("pre-authorized_code", preAuthCode);

    if (transactionCode !== undefined) {
      body = body.set("tx_code", transactionCode);
    }

    const headers = new HttpHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    });
    const postToken = (proof?: string) =>
      this.http.post<OAuthToken>(tokenEndpointUrl, body.toString(), {
        headers: proof ? headers.set("DPoP", proof) : headers,
      });

    return this.fetchNonceResponse(nonceEndpointUrl).pipe(
      switchMap(({ headers: nonceHeaders }) => {
        if (!dpopKeys) {
          return postToken();
        }

        const postTokenWithDpop = (nonce: string | null) =>
          from(
            this.dpopService.createProof(
              dpopKeys,
              "POST",
              tokenEndpointUrl,
              nonce ?? undefined,
            ),
          ).pipe(switchMap((proof) => postToken(proof)));

        return postTokenWithDpop(
          nonceHeaders.get(OIDVCIService.DPOP_NONCE_HEADER),
        ).pipe(
          catchError((error: unknown) => {
            if (
              error instanceof HttpErrorResponse &&
              error.status === 400 &&
              error.error?.error === "use_dpop_nonce"
            ) {
              const nonce = error.headers.get(OIDVCIService.DPOP_NONCE_HEADER);
              if (nonce) {
                return postTokenWithDpop(nonce);
              }
            }

            return throwError(() => error);
          }),
        );
      }),
    );
  }

  fetchNonce(nonceEndpointUrl: string): Observable<NonceResponse> {
    return this.fetchNonceResponse(nonceEndpointUrl).pipe(
      map(({ body }) => body!),
    );
  }

  private fetchNonceResponse(
    nonceEndpointUrl: string,
  ): Observable<HttpResponse<NonceResponse>> {
    if (!nonceEndpointUrl) {
      throw new Error("Missing nonce endpoint");
    }

    return this.http.post<NonceResponse>(
      nonceEndpointUrl,
      {},
      {
        observe: "response",
      },
    );
  }

  fetchCredential(
    credentialEndpointUrl: string,
    nonceEndpointUrl: string,
    payload: any | string,
    bearerToken: string,
    dpopKeys?: DpopKeyPair,
  ): Observable<CredentialEndpointResponse | string> {
    const encrypted = typeof payload === "string";
    const nonceResponse$ = this.fetchNonceResponse(nonceEndpointUrl);
    const headers = {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": encrypted ? "application/jwt" : "application/json",
    };

    if (!!dpopKeys) {
      return nonceResponse$.pipe(
        switchMap(({ headers: nonceHeaders }) =>
          from(
            this.dpopService.createProof(
              dpopKeys,
              "POST",
              credentialEndpointUrl,
              nonceHeaders.get(OIDVCIService.DPOP_NONCE_HEADER) ?? undefined,
              bearerToken,
            ),
          ),
        ),
        switchMap((dpopProof) => {
          console.log("DPoP Proof created:", dpopProof);
          return this.http.post<any | string>(credentialEndpointUrl, payload, {
            headers: { ...headers, DPoP: dpopProof as string },
            responseType: encrypted ? ("text" as any) : "json",
          });
        }),
      );
    }

    return this.http.post<any | string>(credentialEndpointUrl, payload, {
      headers,
      responseType: encrypted ? ("text" as any) : "json",
    });
  }

  public fetchRegistryEntry(
    registryEntryUrl: string,
  ): Observable<RegistryEntry[] | DidResponse> {
    // did.jsonl has one entry per DID version, the last one is the current state
    return this.http
      .get(registryEntryUrl, { responseType: "text" })
      .pipe(map((body) => JSON.parse(body.trim().split("\n").pop()!)));
  }
}
