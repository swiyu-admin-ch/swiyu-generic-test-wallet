import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { OpenIdConfigResponse, OpenIdMetadataResponse, RegistryEntry } from '@app/models/api-response';
import { Observable, from, of, switchMap } from 'rxjs';
import { CredentialEndpointResponse } from 'src/generated/issuer';
import { NonceResponse } from 'src/generated/issuer/model/nonceResponse';
import { OAuthToken } from 'src/generated/issuer/model/oAuthToken';
import { DpopService } from './dpop-service';
import { DpopKeyPair } from './vc-key-store.service';

@Injectable({
  providedIn: 'root',
})
export class OIDVCIService {
  private http = inject(HttpClient);

  private static readonly ISSUER_METADATA_PATH =
    '/.well-known/openid-credential-issuer';
  private static readonly OPENID_CONFIGURATION_PATH =
    '/.well-known/openid-configuration';

  private dpopService = inject(DpopService);

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
    nonceEndpointUrl: string,
    preAuthCode: string,
    dpopKeys?: DpopKeyPair
  ): Observable<OAuthToken> {

    if (!preAuthCode || !tokenEndpointUrl) {
      throw new Error('Missing pre-authorized code or token endpoint');
    }

    const body = new HttpParams()
      .set('grant_type', 'urn:ietf:params:oauth:grant-type:pre-authorized_code')
      .set('pre-authorized_code', preAuthCode);

    const nonce$ = this.fetchNonce(nonceEndpointUrl);
    const proof$ = nonce$.pipe(
      switchMap((resp: NonceResponse) => {
        return dpopKeys ? from(this.dpopService.createProof(dpopKeys, 'POST', tokenEndpointUrl, resp.c_nonce)) : of(null);
      })
    );

    return proof$.pipe(
      switchMap((dpopProof) => {
        const headersObj: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
          "Accept": "application/json",
        };

        if (dpopKeys && dpopProof) {
          headersObj['DPoP'] = dpopProof as string;
        }

        const headers = new HttpHeaders(headersObj);

        return this.http.post<OAuthToken>(tokenEndpointUrl, body.toString(), {
          headers,
          responseType: 'json',
        });
      }),
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
    nonceEndpointUrl: string,
    payload: any | string, 
    bearerToken: string,
    dpopKeys?: DpopKeyPair
  ): Observable<CredentialEndpointResponse | string> {
    const encrypted = typeof payload === 'string';
    const nonce$ = this.fetchNonce(nonceEndpointUrl);
    const headers = {
      "Authorization": `Bearer ${bearerToken}`,
      "Content-Type": encrypted ? "application/jwt" : "application/json"
    };

    if (!!dpopKeys) {
      return nonce$.pipe(
        switchMap((resp: NonceResponse) => from(this.dpopService.createProof(
          dpopKeys,
          "POST",
          credentialEndpointUrl,
          resp.c_nonce,
          bearerToken
        ))),
      switchMap((dpopProof) => {
        console.log("DPoP Proof created:", dpopProof);
        return this.http.post<any | string>(credentialEndpointUrl, payload, {
          headers: { ...headers, DPoP: dpopProof as string },
          responseType: encrypted ? ("text" as any) : "json",
        });
      }));
    }

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
