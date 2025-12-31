import {provideHttpClient, withFetch} from "@angular/common/http";
import {ApplicationConfig} from "@angular/core";
import {provideRouter} from "@angular/router";
import {routes} from "../routes";

export const appConfig: ApplicationConfig = {
    providers: [
        provideHttpClient(withFetch()),
        provideRouter(routes),
    ]
};
