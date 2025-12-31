import {Component} from '@angular/core';
import {MatMenu, MatMenuModule} from "@angular/material/menu";
import {MatIcon} from "@angular/material/icon";
import {MatButtonModule} from "@angular/material/button";
import {CredentialIssuanceV1} from "./credential-issuance-v1/credential-issuance-v1";
import {RouterLink, RouterOutlet} from "@angular/router";
import {MatTabLink, MatTabNav, MatTabNavPanel} from "@angular/material/tabs";
import {routes} from "../routes";

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    standalone: true,
    imports: [MatMenu, MatIcon, MatButtonModule, MatMenuModule, CredentialIssuanceV1, RouterOutlet, MatTabNav, MatTabLink, RouterLink, MatTabNavPanel,]
})
export class AppComponent {

    public routes = routes;
    public activeLink = this.routes[0].path;
}
