import { Injectable, inject } from "@angular/core";
import { RegistryEntry } from "@app/models/api-response";
import { DidResponse, VerificationMethod } from "@app/models/did-response";
import {
  EMPTY,
  from,
  of,
  switchMap,
  catchError,
  map,
  tap,
  Observable,
} from "rxjs";
import { CryptoService } from "@app/services/crypto-service";

@Injectable({
  providedIn: "root",
})
export class RegistryService {
  private cryptoService = inject(CryptoService);

  public getCryptoKeysFromRegistryEntry(
    entry: RegistryEntry[] | DidResponse,
  ): Observable<Promise<CryptoKey>> {
    let verificationMethods: VerificationMethod[];
    if (entry instanceof Array) {
      verificationMethods =
        ((entry[3] as any).value.verificationMethod as VerificationMethod[]) ||
        [];
    } else {
      verificationMethods = (entry as DidResponse).state.verificationMethod;
    }

    return from(
      verificationMethods.map(
        (vm: VerificationMethod) =>
          this.cryptoService.getCryptoKeyFromJwk(
            vm.publicKeyJwk,
          ) as Promise<CryptoKey>,
      ),
    );
  }
}
