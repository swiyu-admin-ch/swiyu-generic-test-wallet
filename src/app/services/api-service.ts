import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  public isLikelyCorsError(error: any): boolean {
    return error?.status === 0;
  }
}
