import {
  Component,
  Input,
  OnChanges,
  signal,
  SimpleChanges,
  WritableSignal,
} from "@angular/core";
import { MatFormField } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../api-service";
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
  @Input({ required: true }) registryEntry: any[];

  decodedHeader: WritableSignal<any> = signal(undefined);
  decodedPayload: WritableSignal<any> = signal(undefined);
  disclosures = signal([]);

  constructor(private apiService: ApiService, private router: Router) {}

  async getCredentialDetails(): Promise<void> {
    const token = this.encodedCredential.split("~");

    const decodedPayload = await jose.decodeJwt(token[0]);
    const decodedHeader = await jose.decodeProtectedHeader(token[0]);

    console.log("decodedHeader", decodedHeader, decodedPayload);
    console.log("registryEntry", this.registryEntry);
    if (this.registryEntry) {
      const verificationMethod =
        this.registryEntry[3]?.value?.verificationMethod
          .map((verificationMethod) =>
            verificationMethod.id === decodedHeader.kid
              ? verificationMethod
              : null
          )
          .filter((verificationMethod) => verificationMethod != null)[0];
      const jwk = verificationMethod?.publicKeyJwk;
      const { payload, protectedHeader } = await jose.jwtVerify(token[0], jwk);
      this.decodedHeader.set(protectedHeader);
      this.decodedPayload.set(payload);

      let disclosures: any[] = [];

      for (let i = 1; i < token.length - 1; i++) {
        disclosures.push(JSON.parse(this.base64UrlDecode(token[i])));
      }

      this.disclosures.set(disclosures);
    }
  }

  public ngOnChanges(changes: SimpleChanges) {
    // changes.prop contains the old and the new value...
    console.log("Credential changed", changes, this.encodedCredential);
    if (this.encodedCredential != undefined) {
      this.getCredentialDetails();
    }
  }

  public onResolve(input: string): void {
    console.log("Credential changed", input);
    this.encodedCredential = input;
  }

  public getDisclosureEntries(disclosure: string[]) {
    console.log(disclosure);
    console.log(disclosure[0]);
    console.log(disclosure[1]);
    console.log(disclosure[2]);
    return disclosure;
  }

  private base64UrlDecode(input: string): string {
    // convert base64url to base64
    input = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = input.length % 4;
    if (pad) input += "=".repeat(4 - pad);

    // decode to bytes and decode UTF-8
    const bytes = Uint8Array.from(atob(input), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  public copyCredentialToClipboard(): void {
    if (this.encodedCredential) {
      navigator.clipboard.writeText(this.encodedCredential).then(
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
