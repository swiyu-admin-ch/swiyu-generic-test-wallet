import { inject, Injectable } from "@angular/core";
import { forkJoin, from, Observable } from "rxjs";
import { PagedModelString } from "../../generated/trust-data/model/pagedModelString";
import { Statements20Service } from "../../generated/trust-data/api/statements20.service";

export interface ValidationResult {
  idTS: string | null;
  piTLS: string | null;
  piaTS: string | null;
}

export interface VerificationTrustStatementsResult {
  pvaTLS: PagedModelString | string | null;
  vqPS: PagedModelString | string | null;
  ncTLS: PagedModelString | string | null;
}

export interface IssuanceTrustStatementsResult {
  ncTLS: PagedModelString | string | null;
  piTLS: PagedModelString | string | null;
}

@Injectable({
  providedIn: "root",
})
export class TrustService {
  private trustStatementService = inject(Statements20Service);

  fetchNcTLS(): Observable<PagedModelString | string> {
    return this.trustStatementService.getActiveNcTLS("body", false, {
      httpHeaderAccept: "text/plain" as "*/*",
    });
  }

  fetchPVATLS(sub: string): Observable<PagedModelString | string> {
    return from(
      this.trustStatementService.listPvaTS(
        sub,
        true,
        0,
        10,
        ["desc"],
        "body",
        false,
        {
          httpHeaderAccept: "application/json" as "*/*",
        },
      ),
    );
  }

  fetchVQPS(sub: string): Observable<PagedModelString | string> {
    return from(
      this.trustStatementService.listVqPS(
        sub,
        true,
        0,
        10,
        ["desc"],
        "body",
        false,
        {
          httpHeaderAccept: "application/json" as "*/*",
        },
      ),
    );
  }

  fetchPiTLS(): Observable<PagedModelString | string> {
    return this.trustStatementService.getActivePiTLS("body", false, {
      httpHeaderAccept: "text/plain" as "*/*",
    });
  }

  getVerificationTrustStatements(
    sub: string,
  ): Observable<VerificationTrustStatementsResult> {
    return forkJoin({
      pvaTLS: this.fetchPVATLS(sub),
      vqPS: this.fetchVQPS(sub),
      ncTLS: this.fetchNcTLS(),
    });
  }

  getIssuanceTrustStatements(): Observable<IssuanceTrustStatementsResult> {
    return forkJoin({
      ncTLS: this.fetchNcTLS(),
      piTLS: this.fetchPiTLS(),
    });
  }
}
