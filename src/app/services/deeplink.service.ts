import { Injectable } from '@angular/core';
import { CredentialOffer } from '@models/credential-offer';

@Injectable({
  providedIn: 'root'
})
export class DeeplinkService {

  public decodeSwiyuDeeplink(deeplink: string): CredentialOffer {
    if (!deeplink) {
      throw new Error('No deeplink provided');
    }

    if (!deeplink.startsWith('swiyu://')) {
      throw new Error('Invalid deeplink format - must start with swiyu://');
    }

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
    const parts = decodedUri.split('credential_offer=');

    if (parts.length < 2) {
      throw new Error('credential_offer parameter not found in deeplink');
    }

    return parts[1];
  }
}

