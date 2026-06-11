import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class StatusService {
  private http = inject(HttpClient);

  getStatusListByUrl(statusListUrl: string): Observable<string> {
    return this.http.get(statusListUrl, { responseType: 'text' });
  }
}
