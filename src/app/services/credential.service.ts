import { Injectable, inject } from '@angular/core';
import * as jose from "jose";
import { RegistryEntry, JwtPayload } from "@app/models/api-response";
import { ToastService } from "./toast.service";

@Injectable({
  providedIn: 'root'
})
export class CredentialService {
  private toastService = inject(ToastService);

  public decodeDeeplink(url: string): Record<string, unknown> {
    if (!url) {
      this.toastService.showError('The deeplink is missing');
      throw new Error('No url provided');
    }
    if (url.startsWith('swiyu://')) {
      const decodedUri = decodeURIComponent(url);
      const json = this.getCredentialOfferString(decodedUri);
      try {
        return JSON.parse(json) as Record<string, unknown>;
      } catch (error) {
        console.error(error);
        this.toastService.showError(`Failed to parse credential offer: ${error}`);
        throw new Error(`Failed to parse credential offer: ${error}`);
      }
    }
    this.toastService.showError('Invalid deeplink format');
    throw new Error('Invalid deeplink format');
  }

  public async createHolderBinding(
    credentialIssuer: string,
    nonce: string,
    proofSigningAlgValuesSupported: string,
    privateKey: CryptoKey,
    jwk: jose.JWK
  ): Promise<string> {
    const claims: Record<string, unknown> = {
      "aud": credentialIssuer,
      "iat": Math.floor(Date.now() / 1000),
      nonce
    }

    const jwt = await new jose.SignJWT(claims)
      .setProtectedHeader({ alg: proofSigningAlgValuesSupported, typ: 'openid4vci-proof+jwt', jwk: jwk })
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setAudience(credentialIssuer)
      .setExpirationTime('2h')
      .sign(privateKey);

    return jwt;
  }

  public async decodeResponse(jwt: string, registryEntry: RegistryEntry[]): Promise<{ payload: JwtPayload, protectedHeader: JwtPayload, }> {
    const kid = (jose.decodeProtectedHeader(jwt) as JwtPayload)['kid'];
    const verificationMethods = (registryEntry[3] as Record<string, unknown>)?.['value'] as Record<string, unknown>;
    const verificationMethod = ((verificationMethods?.['verificationMethod'] as Record<string, unknown>[]) || [])
      .map(meth => (meth as Record<string, unknown>)['id'] === kid ? meth : null)
      .filter((meth: Record<string, unknown> | null): meth is Record<string, unknown> => meth != null)[0];
    const jwk = verificationMethod?.['publicKeyJwk'] as CryptoKey;
    const { payload, protectedHeader } = await jose.jwtVerify(jwt, jwk, {})

    return { payload: payload as JwtPayload, protectedHeader: protectedHeader as JwtPayload };
  }


  private getCredentialOfferString(deeplink: string): string {
    return deeplink.split('credential_offer=')[1];
  }
}
