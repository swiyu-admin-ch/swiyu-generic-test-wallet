import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

type ToastType = 'success' | 'error' | 'info' | 'warning';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private snackBar = inject(MatSnackBar);

  private readonly DEFAULT_DURATION = 3000;

  private show(
    message: string,
    type: ToastType,
    duration: number = this.DEFAULT_DURATION
  ): void {
    this.snackBar.open(message, 'Close', {
      duration,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: [`toast-${type}`],
    });
  }

  showSuccess(message: string, duration?: number): void {
    this.show(message, 'success', duration);
  }

  showError(message: string, duration?: number): void {
    this.show(message, 'error', duration);
  }

  showInfo(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }

  showWarning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }
}
