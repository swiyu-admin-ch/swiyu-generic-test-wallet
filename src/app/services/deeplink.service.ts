import { Injectable } from '@angular/core';
import { CredentialOffer } from '@models/credential-offer';

@Injectable({
  providedIn: 'root'
})
export class DeeplinkService {
  private readonly SWIYU_PROTOCOL = 'swiyu://';
  private readonly OPENID_CREDENTIAL_OFFER_PROTOCOL = 'openid-credential-offer://';
  private readonly CREDENTIAL_OFFER_PARAM = 'credential_offer=';

  private readonly SWIYU_VERIFY_PROTOCOL = 'swiyu-verify://';
  private readonly OPENID4VP_PROTOCOL = 'openid4vp://';
  private readonly HTTPS_PROTOCOL = 'https://';
  private readonly HTTP_PROTOCOL = 'http://';

  public decodeSwiyuDeeplink(deeplink: string): CredentialOffer {
    if (!deeplink) {
      throw new Error('No deeplink provided');
    }

    if (deeplink.startsWith(this.SWIYU_PROTOCOL) || deeplink.startsWith(this.OPENID_CREDENTIAL_OFFER_PROTOCOL)) {
      return this.decodeSwiyu(deeplink);
    }

    throw new Error('Invalid deeplink format - must start with swiyu:// or openid-credential-offer://');
  }

  public decodeVerificationDeeplink(url: string): Record<string, string> {
    if (!url) {
      throw new Error('decode');
    }

    if (url.startsWith(this.SWIYU_VERIFY_PROTOCOL) || url.startsWith(this.OPENID4VP_PROTOCOL)) {
      return this.decodeUrlSchemeDeeplink(url);
    }

    if (url.startsWith(this.HTTPS_PROTOCOL) || url.startsWith(this.HTTP_PROTOCOL)) {
      return this.decodeHttpDeeplink(url);
    }

    throw new Error('decode');
  }

  private decodeUrlSchemeDeeplink(url: string): Record<string, string> {
    const protocol = url.startsWith(this.SWIYU_VERIFY_PROTOCOL)
      ? this.SWIYU_VERIFY_PROTOCOL
      : this.OPENID4VP_PROTOCOL;

    const withoutProtocol = url.replace(protocol + '?', '');
    const decodedUri = decodeURIComponent(withoutProtocol);

    const params = new URLSearchParams(decodedUri);
    const result: Record<string, string> = {};

    params.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }

  private decodeHttpDeeplink(url: string): Record<string, string> {
    return {
      request_uri: url
    };
  }

  private decodeSwiyu(deeplink: string): CredentialOffer {
    try {
      const decodedUri = decodeURIComponent(deeplink);
      const credentialOfferString = this.extractCredentialOfferString(decodedUri);
      const credentialOffer = JSON.parse(credentialOfferString) as CredentialOffer;

      if (!credentialOffer.credential_issuer || !credentialOffer.credential_configuration_ids) {
        throw new Error('Missing required fields in credential offer');
      }

      return credentialOffer;
    } catch (error) {
      throw new Error(`Failed to parse credential offer: ${error}`);
    }
  }

  private extractCredentialOfferString(decodedUri: string): string {
    const parts = decodedUri.split(this.CREDENTIAL_OFFER_PARAM);

    if (parts.length < 2) {
      throw new Error('credential_offer parameter not found in deeplink');
    }

    return parts[1];
  }
}

