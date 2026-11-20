import { provideHttpClient, withFetch } from "@angular/common/http";
import { ApplicationConfig, APP_INITIALIZER } from "@angular/core";
import { provideRouter, withHashLocation } from "@angular/router";
import { provideAnimations } from "@angular/platform-browser/animations";
import { routes } from "../routes";
import { HolderKeyService } from "@services/holder-key.service";
import { provideApi as provideTrustDataApi } from "src/generated/trust-data/provide-api";
import { environment } from "src/environments/environment";

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideRouter(routes, withHashLocation()),
    provideAnimations(),
    provideTrustDataApi(environment.trustApiBaseUrl),
    HolderKeyService,
    {
      provide: APP_INITIALIZER,
      useFactory: (holderKeyService: HolderKeyService) => {
        return () => holderKeyService.initializeKeys();
      },
      deps: [HolderKeyService],
      multi: true,
    },
  ],
};
