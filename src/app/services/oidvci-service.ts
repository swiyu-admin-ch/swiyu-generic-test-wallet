import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CredentialResponse, OpenIdConfigResponse, OpenIdMetadataResponse, RegistryEntry } from '@app/models/api-response';
import { catchError, Observable } from 'rxjs';
import { CredentialEndpointRequest } from 'src/generated/issuer/model/credentialEndpointRequest';
import { NonceResponse } from 'src/generated/issuer/model/nonceResponse';
import { OAuthToken } from 'src/generated/issuer/model/oAuthToken';

@Injectable({
  providedIn: 'root',
})
export class OIDVCIService {
  private http = inject(HttpClient);

  private static readonly ISSUER_METADATA_PATH =
    '/.well-known/openid-credential-issuer';
  private static readonly OPENID_CONFIGURATION_PATH =
    '/.well-known/openid-configuration';

  fetchIssuerMetadata(
    issuerUrl: string,
    signed = false
  ): Observable<OpenIdMetadataResponse | string> {
    if (!issuerUrl) {
      throw new Error('issuerUrl is required');
    }

    const url = `${issuerUrl}${OIDVCIService.ISSUER_METADATA_PATH}`;

    if (signed) {
      return this.http.get(url, {
        responseType: 'text',
        headers: new HttpHeaders({
          Accept: 'application/jwt',
        }),
      });
    }

    return this.http.get<OpenIdMetadataResponse>(url, {
      headers: new HttpHeaders({
        Accept: 'application/json',
      }),
    });
  }

  fetchOpenIdConfiguration(
    issuerUrl: string,
    signed = false
  ): Observable<OpenIdConfigResponse | string> {
    const url = `${issuerUrl}${OIDVCIService.OPENID_CONFIGURATION_PATH}`;

    if (signed) {
      return this.http.get(url, {
        responseType: 'text',
        headers: new HttpHeaders({
          Accept: 'application/jwt',
        }),
      });
    }

    return this.http.get<OpenIdConfigResponse>(url, {
      headers: new HttpHeaders({
        Accept: 'application/json',
      }),
    });
  }

  fetchAccessToken(
    tokenEndpointUrl: string,
    preAuthCode: string,
  ): Observable<OAuthToken> {

    if (!preAuthCode || !tokenEndpointUrl) {
      throw new Error('Missing pre-authorized code or token endpoint');
    }

    const body = new HttpParams()
      .set('grant_type', 'urn:ietf:params:oauth:grant-type:pre-authorized_code')
      .set('pre-authorized_code', preAuthCode);

    return this.http.post<OAuthToken>(
      tokenEndpointUrl,
      body.toString(),
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
        responseType: 'json',
      }
    );
  }

  fetchNonce(
    nonceEndpointUrl: string
  ): Observable<NonceResponse> {

    if (!nonceEndpointUrl) {
      throw new Error('Missing nonce endpoint');
    }

    return this.http.post<NonceResponse>(
      nonceEndpointUrl, {},
      {
        responseType: 'json',
      }
    );
  }

  fetchCredential(
    credentialEndpointUrl: string,
    payload: CredentialEndpointRequest | string, 
    bearerToken: string
  ): Observable<any | string> {
    const encrypted = typeof payload === 'string'
    
    let headers = new HttpHeaders({
      "Authorization": `Bearer ${bearerToken}`,
      "SWIYU-API-Version": "2",
      "Content-Type": encrypted ? "application/jwt" : "application/json"
    });

    return this.http.post<any | string>(
      credentialEndpointUrl, 
      payload,
      {
        headers,
        responseType: encrypted ? ('text' as any) : ('json'),
      }
    );

  }

  public fetchRegistryEntry(registryEntryUrl: string): Observable<RegistryEntry[]> {
    return this.http.get<RegistryEntry[]>(
      registryEntryUrl
    )
  }
}
