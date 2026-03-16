import { Injectable } from '@angular/core';
import * as jose from 'jose';
import { JwtPayload } from '@app/models/api-response';

export interface DecodedSdJwt {
  isValid: boolean;
  error?: string;
  header?: JwtPayload;
  payload?: JwtPayload;
  disclosures?: Record<string, unknown>[];
}

@Injectable({
  providedIn: 'root'
})
export class SdJwtDecoderService {

  decodeSdJwt(credential: string): DecodedSdJwt {
    try {
      if (!credential || typeof credential !== 'string') {
        return {
          isValid: false,
          error: 'Invalid credential format'
        };
      }

      const parts = credential.split('~');
      if (parts.length < 2) {
        return {
          isValid: false,
          error: 'Invalid SD-JWT format. Expected format: <JWT>~<disclosure1>~<disclosure2>~...'
        };
      }

      const jwt = parts[0];
      let header: JwtPayload | undefined;
      let payload: JwtPayload | undefined;

      try {
        header = jose.decodeProtectedHeader(jwt) as JwtPayload;
        payload = jose.decodeJwt(jwt) as JwtPayload;
      } catch (error) {
        return {
          isValid: false,
          error: `Failed to decode JWT: ${(error as Error).message}`
        };
      }

      const disclosures: Record<string, unknown>[] = [];
      for (let i = 1; i < parts.length - 1; i++) {
        try {
          const disclosure = JSON.parse(this.base64UrlDecode(parts[i])) as Record<string, unknown>;
          disclosures.push(disclosure);
        } catch (error) {
          disclosures.push({
            _error: `Failed to decode disclosure: ${(error as Error).message}`,
            raw: parts[i]
          });
        }
      }

      return {
        isValid: true,
        header,
        payload,
        disclosures
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Unexpected error: ${(error as Error).message}`
      };
    }
  }

  extractClaims(credential: string): Record<string, unknown> {
    const decoded = this.decodeSdJwt(credential);
    if (!decoded.isValid || !decoded.payload) {
      return {};
    }
    return decoded.payload;
  }

  isValidSdJwtFormat(credential: string): boolean {
    if (!credential || typeof credential !== 'string') {
      return false;
    }
    const parts = credential.split('~');
    return parts.length >= 2;
  }

  private base64UrlDecode(input: string): string {
    try {
      let decodedInput = input.replace(/-/g, '+').replace(/_/g, '/');
      const pad = decodedInput.length % 4;
      if (pad) {
        decodedInput += '='.repeat(4 - pad);
      }

      const bytes = Uint8Array.from(atob(decodedInput), (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch (error) {
      throw new Error(`Failed to decode base64url: ${(error as Error).message}`);
    }
  }
}

