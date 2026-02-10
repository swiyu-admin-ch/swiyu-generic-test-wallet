import {
  Component,
  inject,
  Input,
  OnChanges,
  signal,
  SimpleChanges,
  WritableSignal,
} from "@angular/core";
import { MatFormField } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { MatCard, MatCardContent, MatCardTitle } from "@angular/material/card";
import * as jose from "jose";
import { MatAccordion } from "@angular/material/expansion";
import { PanelComponent } from "../deeplink-resolver/panel.component";
import { ChecklistEntry } from "../checklist-entry/checklist-entry";
import { MatList } from "@angular/material/list";
import {
  MatGridList,
  MatGridTile,
  MatGridTileHeaderCssMatStyler,
} from "@angular/material/grid-list";
import { DeeplinkInput } from "../deeplink-input/deeplink-input";
import { MatButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { Router } from "@angular/router";
import { JwtPayload, RegistryEntry } from "@app/models/api-response";

@Component({
  selector: "app-credential",
  standalone: true,
  imports: [
    MatFormField,
    MatInput,
    CommonModule,
    FormsModule,
    MatCard,
    MatCardContent,
    MatCardTitle,
    MatAccordion,
    PanelComponent,
    ChecklistEntry,
    MatList,
    MatGridList,
    MatGridTile,
    MatGridTileHeaderCssMatStyler,
    DeeplinkInput,
    MatButton,
    MatIcon,
  ],
  templateUrl: "./credential.html",
  styleUrl: "./credential.css",
})
export class Credential implements OnChanges {
  @Input({ required: true }) encodedCredential: string;
  @Input({ required: true }) registryEntry: RegistryEntry[];

  private router = inject(Router);

  decodedHeader: WritableSignal<JwtPayload | undefined> = signal(undefined);
  decodedPayload: WritableSignal<JwtPayload | undefined> = signal(undefined);
  disclosures: WritableSignal<Record<string, unknown>[]> = signal([]);

  async getCredentialDetails(): Promise<void> {
    const token = this.encodedCredential.split("~");

    const decodedPayload = (await jose.decodeJwt(token[0])) as JwtPayload;
    const decodedHeader = (await jose.decodeProtectedHeader(token[0])) as JwtPayload;

    console.log("decodedHeader", decodedHeader, decodedPayload);
    console.log("registryEntry", this.registryEntry);
    if (this.registryEntry) {
      const registryValue = this.registryEntry[3] as Record<string, unknown>;
      const verificationMethods = (registryValue?.value as Record<string, unknown>)?.verificationMethod as Record<string, unknown>[];

      const verificationMethod =
        verificationMethods
          .map((verificationMethod: Record<string, unknown>) =>
            verificationMethod.id === decodedHeader.kid
              ? verificationMethod
              : null
          )
          .filter((verificationMethod: Record<string, unknown> | null): verificationMethod is Record<string, unknown> => verificationMethod != null)[0];
      const jwk = verificationMethod?.publicKeyJwk;
      const { payload, protectedHeader } = await jose.jwtVerify(token[0], jwk as CryptoKey);
      this.decodedHeader.set(protectedHeader as JwtPayload);
      this.decodedPayload.set(payload as JwtPayload);

      const disclosures: Record<string, unknown>[] = [];

      for (let i = 1; i < token.length - 1; i++) {
        disclosures.push(JSON.parse(this.base64UrlDecode(token[i])) as Record<string, unknown>);
      }

      this.disclosures.set(disclosures);
    }
  }

  public ngOnChanges(changes: SimpleChanges): void {
    // changes.prop contains the old and the new value...
    console.log("Credential changed", changes, this.encodedCredential);
    if (this.encodedCredential != null) {
      this.getCredentialDetails();
    }
  }

  public onResolve(input: string): void {
    console.log("Credential changed", input);
    this.encodedCredential = input;
  }

  public getDisclosureEntries(disclosure: Record<string, unknown>[]): Record<string, unknown>[] {
    console.log(disclosure);
    console.log(disclosure[0]);
    console.log(disclosure[1]);
    console.log(disclosure[2]);
    return disclosure;
  }

  private base64UrlDecode(input: string): string {
    // convert base64url to base64
    let decodedInput = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = decodedInput.length % 4;
    if (pad) decodedInput += "=".repeat(4 - pad);

    // decode to bytes and decode UTF-8
    const bytes = Uint8Array.from(atob(decodedInput), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  public copyCredentialToClipboard(): void {
    if (this.encodedCredential) {
      void navigator.clipboard.writeText(this.encodedCredential).then(
        () => {
          console.log("Credential copied to clipboard");
        },
        () => {
          console.error("Failed to copy credential to clipboard");
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
