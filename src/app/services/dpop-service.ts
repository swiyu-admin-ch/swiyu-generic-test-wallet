import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders, HttpParams } from "@angular/common/http";
import { SignJWT } from "jose";

import { firstValueFrom } from "rxjs";
import { OAuthToken } from "src/generated/issuer/model/models";
import { DpopKeyPair } from "./vc-key-store.service";

@Injectable({
  providedIn: "root",
})
export class DpopService {
  constructor(private http: HttpClient) {}

  async createProof(
    dpopKeys: DpopKeyPair,
    method: string,
    url: string,
    nonce?: string,
    accessToken?: string,
  ): Promise<string> {
    if (!dpopKeys) {
      throw new Error("DPoP keypair unavailable");
    }

    const payload: Record<string, any> = {
      htm: method.toUpperCase(),
      htu: this.normalizeUrl(url),
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID(),
    };

    if (nonce) {
      payload["nonce"] = nonce;
    }

    if (accessToken) {
      payload["ath"] = await this.createAth(accessToken);
    }

    console.log("dpop jwt", dpopKeys.jwk);

    return new SignJWT(payload)
      .setProtectedHeader({
        typ: "dpop+jwt",
        alg: "ES256",
        jwk: dpopKeys.jwk,
      })
      .sign(dpopKeys.privateKey);
  }

  async requestToken(
    dpopKeys: DpopKeyPair,
    tokenEndpoint: string,
    params: Record<string, string>,
    requireDpop = true,
  ): Promise<OAuthToken> {
    const proof = await this.createProof(dpopKeys, "POST", tokenEndpoint);

    const body = new HttpParams({
      fromObject: params,
    });

    const headers = new HttpHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
      DPoP: proof,
    });

    const response = await firstValueFrom(
      this.http.post<OAuthToken>(tokenEndpoint, body.toString(), {
        headers,
      }),
    );

    if (requireDpop && response.token_type !== "DPoP") {
      throw new Error("Authorization server returned non-DPoP token");
    }

    return response;
  }

  async requestAuthorizationCodeToken(
    tokenEndpoint: string,
    clientId: string,
    code: string,
    redirectUri: string,
    codeVerifier: string,
    dpopKeys: DpopKeyPair,
  ): Promise<OAuthToken> {
    return this.requestToken(dpopKeys, tokenEndpoint, {
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });
  }

  async refreshToken(
    tokenEndpoint: string,
    clientId: string,
    refreshToken: string,
    dpopKeys: DpopKeyPair,
  ): Promise<OAuthToken> {
    return this.requestToken(dpopKeys, tokenEndpoint, {
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    });
  }

  private async createAth(accessToken: string): Promise<string> {
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(accessToken),
    );

    return this.base64UrlEncode(new Uint8Array(hash));
  }

  private base64UrlEncode(input: string | Uint8Array): string {
    let bytes: Uint8Array;

    if (typeof input === "string") {
      bytes = new TextEncoder().encode(input);
    } else {
      bytes = input;
    }

    let binary = "";

    for (const b of bytes) {
      binary += String.fromCharCode(b);
    }

    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  private normalizeUrl(url: string): string {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  }
}
