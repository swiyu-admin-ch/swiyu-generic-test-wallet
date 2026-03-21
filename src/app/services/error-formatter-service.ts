import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ErrorFormatterService {
  private DEFAULT_ERROR_MESSAGE = "Check DevTools for more information."

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
