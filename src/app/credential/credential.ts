import {
  Component,
  inject,
  Input,
  OnChanges,
  Output,
  EventEmitter,
  signal,
  WritableSignal,
} from "@angular/core";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import * as jose from "jose";
import { MatButton } from "@angular/material/button";
import { Router } from "@angular/router";
import { JwtPayload, RegistryEntry } from "@app/models/api-response";
import { ToastService } from "@app/services/toast.service";

@Component({
  selector: "app-credential",
  standalone: true,
  imports: [
    MatFormField,
    MatInput,
    CommonModule,
    FormsModule,
    MatButton,
    MatLabel
  ],
  templateUrl: "./credential.html",
  styleUrl: "./credential.css",
})
export class Credential implements OnChanges {
  @Input({ required: true }) encodedCredential: string;
  @Input({ required: true }) registryEntry: RegistryEntry[];
  @Output() credentialChange = new EventEmitter<string>();

  private router = inject(Router);
  private toastService = inject(ToastService);

  decodedHeader: WritableSignal<JwtPayload | undefined> = signal(undefined);
  decodedPayload: WritableSignal<JwtPayload | undefined> = signal(undefined);
  disclosures: WritableSignal<Record<string, unknown>[]> = signal([]);

  async getCredentialDetails(): Promise<void> {
    if (!this.encodedCredential) {
      return;
    }

    const token = this.encodedCredential.split("~");

    if (token.length < 1) {
      return;
    }

    try {
      const decodedHeader = (await jose.decodeProtectedHeader(token[0])) as JwtPayload;

      if (this.registryEntry && this.registryEntry.length > 0) {
        const registryValue = this.registryEntry[3] as Record<string, unknown>;
        const verificationMethods = (registryValue?.value as Record<string, unknown>)?.verificationMethod as Record<string, unknown>[];

        if (verificationMethods && verificationMethods.length > 0) {
          const verificationMethod =
            verificationMethods
              .map((verificationMethod: Record<string, unknown>) =>
                verificationMethod.id === decodedHeader.kid
                  ? verificationMethod
                  : null
              )
              .filter((verificationMethod: Record<string, unknown> | null): verificationMethod is Record<string, unknown> => verificationMethod != null)[0];

          if (verificationMethod) {
            const jwk = verificationMethod?.publicKeyJwk;
            const { payload, protectedHeader } = await jose.jwtVerify(token[0], jwk as CryptoKey);
            this.decodedHeader.set(protectedHeader as JwtPayload);
            this.decodedPayload.set(payload as JwtPayload);
          } else {
            this.decodeWithoutVerification(token, decodedHeader);
          }
        } else {
          this.decodeWithoutVerification(token, decodedHeader);
        }
      } else {
        this.decodeWithoutVerification(token, decodedHeader);
      }

      const disclosures: Record<string, unknown>[] = [];
      for (let i = 1; i < token.length - 1; i++) {
        try {
          disclosures.push(JSON.parse(this.base64UrlDecode(token[i])) as Record<string, unknown>);
        } catch (e) {
          console.error('Error decoding disclosure', e);
        }
      }
      this.disclosures.set(disclosures);
    } catch (error) {
      console.error('Error decoding credential', error);
      this.clearCredentialDetails();
    }
  }

  private decodeWithoutVerification(token: string[], decodedHeader: JwtPayload): void {
    try {
      const decodedPayload = jose.decodeJwt(token[0]) as JwtPayload;
      this.decodedHeader.set(decodedHeader);
      this.decodedPayload.set(decodedPayload);
    } catch (error) {
      console.error('Error decoding payload', error);
    }
  }

  private clearCredentialDetails(): void {
    this.decodedHeader.set(undefined);
    this.decodedPayload.set(undefined);
    this.disclosures.set([]);
  }

  public ngOnChanges(): void {
    if (this.encodedCredential != null) {
      this.getCredentialDetails();
    }
  }

  public onResolve(input: string): void {
    this.encodedCredential = input;
    this.credentialChange.emit(input);
    this.getCredentialDetails();
  }

  public getDisclosureEntries(disclosure: Record<string, unknown>[]): Record<string, unknown>[] {
    return disclosure;
  }

  private base64UrlDecode(input: string): string {
    let decodedInput = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = decodedInput.length % 4;
    if (pad) decodedInput += "=".repeat(4 - pad);

    const bytes = Uint8Array.from(atob(decodedInput), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  public copyCredentialToClipboard(): void {
    if (this.encodedCredential) {
      void navigator.clipboard.writeText(this.encodedCredential).then(
        () => {
          this.toastService.showSuccess("SD-JWT VCI copied to the clipboard");
        },
        () => {
          this.toastService.showError("Failed to copy the SD-JWT VCI to the clipboard");
        }
      );
    }
  }

  public goToVerification(version: string): void {
    this.router.navigate([`/verifications/${version}`], {
      state: { credential: this.encodedCredential }
    });
  }
}
