import {provideHttpClient, withFetch} from "@angular/common/http";
import {ApplicationConfig, APP_INITIALIZER} from "@angular/core";
import {provideRouter} from "@angular/router";
import {routes} from "../routes";
import {HolderKeyService} from "@services/holder-key.service";

export const appConfig: ApplicationConfig = {
    providers: [
        provideHttpClient(withFetch()),
        provideRouter(routes),
        HolderKeyService,
        {
            provide: APP_INITIALIZER,
            useFactory: (holderKeyService: HolderKeyService) => {
                return () => holderKeyService.initializeKeys();
            },
            deps: [HolderKeyService],
            multi: true,
        }
    ]
};
