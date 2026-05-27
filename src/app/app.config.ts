import { provideHttpClient, withFetch } from "@angular/common/http";
import { ApplicationConfig, APP_INITIALIZER } from "@angular/core";
import { provideRouter, withHashLocation } from "@angular/router";
import { provideAnimations } from "@angular/platform-browser/animations";
import { routes } from "../routes";
import { HolderKeyService } from "@services/holder-key.service";
import { provideApi as provideTrustApi } from "src/generated/trust/provide-api";

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideRouter(routes, withHashLocation()),
    provideAnimations(),
    provideTrustApi('https://trust-data-service-int-a.apps.p-szb-ros-shrd-npr-01.cloud.admin.ch'),
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
