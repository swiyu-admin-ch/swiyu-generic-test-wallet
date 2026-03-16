import { Component } from '@angular/core';
import { MatMenuModule } from "@angular/material/menu";
import { MatButtonModule } from "@angular/material/button";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { MatTabLink, MatTabNav, MatTabNavPanel } from "@angular/material/tabs";
import { routes } from "../routes";
import { HeaderComponent } from "@components/header/header.component";
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    standalone: true,
    imports: [
        MatButtonModule,
        MatMenuModule,
        RouterOutlet,
        MatTabNav,
        MatTabLink,
        RouterLink,
        RouterLinkActive,
        MatTabNavPanel,
        HeaderComponent,
        CommonModule
    ]
})
export class AppComponent {
    public routes = routes;
}
