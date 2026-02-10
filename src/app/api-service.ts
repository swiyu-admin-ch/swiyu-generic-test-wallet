import { inject, Injectable } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from "@angular/common/http";
import { catchError, Observable, throwError, map } from "rxjs";
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

    console.log(
      "getCredentialV2 payload",
      issuerCredentialUrl,
      bearerToken,
      payload
    );

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

  public submitVerificationResponseDcql(
    responseDataUri: string,
    vpToken: string,
    credentialId = "credential_1"
  ): Observable<string> {
    if (!responseDataUri) {
      return throwError(() => new Error("No response_uri provided"));
    }

    const vpTokenMap: VpTokenMap = {};
    vpTokenMap[credentialId] = [vpToken];
    const vpTokenJson = JSON.stringify(vpTokenMap);

    const body = new HttpParams()
      .set("vp_token", vpTokenJson);

    const headers = new HttpHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
      "SWIYU-API-Version": "2"
    });

    return this.http
      .post(responseDataUri, body.toString(), {
        headers: headers,
        responseType: "text"
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error("DCQL submission failed:", error);
          return throwError(() => new Error("Failed to submit DCQL verification response"));
        })
      );
  }
}
