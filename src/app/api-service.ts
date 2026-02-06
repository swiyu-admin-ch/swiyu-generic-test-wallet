import { Injectable } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from "@angular/common/http";
import { catchError, Observable, throwError, map } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  constructor(private http: HttpClient) {}

  public resolveOpenIdMetadataFromDeeplink(
    issuerCredentialUrl: string
  ): Observable<any> {
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

  public resolveRequestObjectFromDeeplink(
    verifierRequestObjectUrl: string
  ) : any {
    if (!verifierRequestObjectUrl) {
      return throwError(() => new Error("No verifier request object URL provided"));
    }

    return this.http
      .get<any>(`${verifierRequestObjectUrl}`, {
        responseType: "text" as any,
      })
      .pipe(
        map((response: string) => {
          try {
            return JSON.parse(response);
          } catch (e) {
            return this.decodeJwtPayload(response);
          }
        }),
        catchError(this.handleError)
      );
  }

  private decodeJwtPayload(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format");
      }

      const payload = parts[1];
      const decoded = atob(payload);
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error(`Failed to decode JWT payload: ${error}`);
    }
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

  public getCredentialV2WithEncryption(
    issuerCredentialUrl: string,
    bearerToken: string,
    payload: any,
    isEncrypted: boolean = false
  ): any {
    if (!issuerCredentialUrl) {
      return "No issuer_credential_url provided";
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${bearerToken}`,
      "SWIYU-API-Version": "2",
      "Content-Type": isEncrypted ? "application/jwt" : "application/json"
    });

    const bodyToSend = isEncrypted ? payload : payload;

    return this.http
      .post<any>(issuerCredentialUrl, bodyToSend, {
        responseType: isEncrypted ? ("text" as any) : "json",
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

  public submitVerificationResponse(
    responseDataUri: string,
    vpToken: string,
    presentationSubmission: any
  ): Observable<any> {
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
        responseType: "text" as any
      })
      .pipe(
        catchError((error) => {
          console.error("Error submitting verification response:", error);
          return throwError(() => new Error("Failed to submit verification response"));
        })
      );
  }

  public submitVerificationResponseDcql(
    responseDataUri: string,
    vpToken: string,
    credentialId: string = "credential_1",
    encryptionRequired: boolean = false,
    clientMetadata?: any
  ): Observable<any> {
    if (!responseDataUri) {
      return throwError(() => new Error("No response_uri provided"));
    }

    const vpTokenMap: { [key: string]: string[] } = {};
    vpTokenMap[credentialId] = [vpToken];
    const vpTokenJson = JSON.stringify(vpTokenMap);

    const body = new HttpParams();

    if (encryptionRequired && clientMetadata) {
      body.set("response", vpTokenJson);
    } else {
      body.set("vp_token", vpTokenJson);
    }

    const headers = new HttpHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
      "SWIYU-API-Version": "2"
    });

    return this.http
      .post(responseDataUri, body.toString(), {
        headers: headers,
        responseType: "text" as any
      })
      .pipe(
        catchError((error) => {
          console.error("DCQL submission failed:", error);
          return throwError(() => new Error("Failed to submit DCQL verification response"));
        })
      );
  }

  public submitVerificationResponseDcqlEncrypted(
    responseDataUri: string,
    encryptedJwe: string
  ): Observable<any> {
    if (!responseDataUri) {
      return throwError(() => new Error("No response_uri provided"));
    }

    const body = new HttpParams()
      .set("response", encryptedJwe);

    const headers = new HttpHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
      "SWIYU-API-Version": "2"
    });

    return this.http
      .post(responseDataUri, body.toString(), {
        headers: headers,
        responseType: "text" as any
      })
      .pipe(
        catchError((error) => {
          console.error("Encrypted DCQL submission failed:", error);
          return throwError(() => new Error("Failed to submit encrypted DCQL verification response"));
        })
      );
  }
}
