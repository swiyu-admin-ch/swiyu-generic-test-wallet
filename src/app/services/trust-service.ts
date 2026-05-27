import { inject, Injectable } from "@angular/core";
import { Observable, forkJoin, from, of, switchMap } from "rxjs";
import {
  Statements20Service,
} from "src/generated/trust/api/api";

export interface ValidationResult {
  idTS: string | null;
  piTLS: string | null;
  piaTS: string | null;
}

@Injectable({
  providedIn: "root",
})
export class TrustService {
  private trustStatementService = inject(Statements20Service);

  fetchNcTLS(): Observable<string> {
    return from(this.trustStatementService.getActiveNcTLS());
  }
}
