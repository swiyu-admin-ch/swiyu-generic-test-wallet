import { Component } from '@angular/core';
import { MatMenuModule } from "@angular/material/menu";
import { MatButtonModule } from "@angular/material/button";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { MatTabLink, MatTabNav, MatTabNavPanel } from "@angular/material/tabs";
import { routes } from "../routes";

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    standalone: true,
    imports: [MatButtonModule, MatMenuModule, RouterOutlet, MatTabNav, MatTabLink, RouterLink, RouterLinkActive, MatTabNavPanel,]
})
export class AppComponent {
    public routes = routes;
}
