import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ErrorFormatterService {
  private DEFAULT_ERROR_MESSAGE = "Check DevTools for more information."
  public CORS_ERROR_MESSAGE = `
Browser CORS Restriction Detected

The request appears to be blocked by the browser's CORS policy.

When testing the wallet against issuer or verifier endpoints hosted on different domains, the browser may prevent these requests from succeeding.

For development and testing purposes, you may temporarily disable CORS in your browser.

⚠️ Security Warning: Only do this in a dedicated browser profile used exclusively for testing. Never disable CORS in your main browser.

Example (Google Chrome)

google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev_session"
`;

  format(error: unknown): string | Record<string, unknown> {
    if (error instanceof HttpErrorResponse) {
      return this.formatHttpError(error);
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        hint: this.DEFAULT_ERROR_MESSAGE
      };
    }

    return {
      message: 'Error',
      hint: this.DEFAULT_ERROR_MESSAGE
    };
  }

  private formatHttpError(error: HttpErrorResponse): Record<string, unknown> {
    let response: unknown = null;

    if (error.error) {
      if (typeof error.error === 'string') {
        response = error.error;
      } else if (error.error.message) {
        response = error.error.message;
      } else {
        response = error.error;
      }
    }

    return {
      request: error.url ?? 'Unknown URL',
      status: `${error.status} ${error.statusText}`,
      response,
      hint: this.DEFAULT_ERROR_MESSAGE
    };
  }
}
