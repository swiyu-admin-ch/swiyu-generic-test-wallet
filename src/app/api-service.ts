import { Injectable } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from "@angular/common/http";
import { catchError, Observable, throwError } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  constructor(private http: HttpClient) {}

  public resolveOpenIdMetadataFromDeeplink(
    issuerCredentialUrl: string
  ): Observable<any> {
    console.log("issuerCredentialUrl", issuerCredentialUrl);

    return this.http
      .get<any>(`${issuerCredentialUrl}/.well-known/openid-credential-issuer`, {
        responseType: "json",
      })
      .pipe(catchError(this.handleError));
  }

  public resolveOpenIdConfigMetadataFromDeeplink(
    issuerCredentialUrl: string
  ): any {
    if (!issuerCredentialUrl) {
      return "No issuer_credential_url provided";
    }

    return this.http
      .get<any>(`${issuerCredentialUrl}/.well-known/openid-configuration`, {
        responseType: "json",
      })
      .pipe(catchError(this.handleError));
  }

  public getAccessToken(preAuthCode: string, tokenEndpointUrl: string): any {
    if (!preAuthCode || !tokenEndpointUrl) {
      return throwError(() => new Error("No pre-authorized code provided"));
    }

    const body = new HttpParams()
      .set("grant_type", "urn:ietf:params:oauth:grant-type:pre-authorized_code")
      .set("pre-authorized_code", preAuthCode);

    return this.http
      .post<any>(tokenEndpointUrl, body.toString(), {
        responseType: "json",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
      .pipe(catchError((err) => this.handleError(err)));
  }

  public getNonce(nonceEndpoint: string): any {
    if (!nonceEndpoint) {
      throwError(() => new Error("No nonce_endpoint provided"));
    }

    // ${nonceEndpoint}/oid4vci/api/nonce
    return this.http
      .post<any>(`${nonceEndpoint}`, {
        responseType: "json",
      })
      .pipe(catchError(this.handleError));
  }

  public getCredential(
    issuerCredentialUrl: string,
    bearerToken: string,
    payload: any
  ): any {
    if (!issuerCredentialUrl) {
      return "No issuer_credential_url provided";
    }

    return this.http
      .post<any>(issuerCredentialUrl, payload, {
        responseType: "json",
        headers: { Authorization: `Bearer ${bearerToken}` },
      })
      .pipe(catchError(this.handleError));
  }

  public getCredentialV2(
    issuerCredentialUrl: string,
    bearerToken: string,
    payload: any
  ): any {
    if (!issuerCredentialUrl) {
      return "No issuer_credential_url provided";
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
      .post<any>(issuerCredentialUrl, payload, {
        responseType: "json",
        headers: headers,
      })
      .pipe(catchError(this.handleError));
  }

  public getRegistryEntry(registryEntryUrl: string): Observable<any[]> {
    const url = this.getRegistryEntryLocation(registryEntryUrl);
    return this.http.get<any>(url).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    console.error(error);
    return throwError(() => new Error("An error occurred while fetching data"));
  }

  private getRegistryEntryLocation(iss: string): string {
    const parts = iss.split(":");

    return `https://${decodeURIComponent(
      iss.substring(iss.indexOf(parts[3]), iss.length).replace(/:/g, "/")
    )}/did.jsonl`;
  }
}
