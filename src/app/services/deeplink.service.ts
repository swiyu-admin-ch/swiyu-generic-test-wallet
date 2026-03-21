import { Injectable } from '@angular/core';
import { CredentialOffer } from '@models/credential-offer';

@Injectable({
  providedIn: 'root'
})
export class DeeplinkService {

  /**
   * Decode a swiyu:// deeplink and extract the credential offer JSON
   * @param deeplink - The swiyu:// deeplink URL
   * @returns Parsed credential offer as a CredentialOffer object
   * @throws Error if deeplink is invalid or parsing fails
   */

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

  /**
   * Extract the credential_offer parameter value from a swiyu:// deeplink
   * @param decodedUri - The decoded URI string
   * @returns The credential offer string (still URL-encoded)
   * @throws Error if credential_offer parameter is not found
   */
  private extractCredentialOfferString(decodedUri: string): string {
    const parts = decodedUri.split('credential_offer=');

    if (parts.length < 2) {
      throw new Error('credential_offer parameter not found in deeplink');
    }

    return parts[1];
  }
}

