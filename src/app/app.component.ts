import { Component, inject } from '@angular/core';
import { MatMenuModule } from "@angular/material/menu";
import { MatButtonModule } from "@angular/material/button";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { MatTabLink, MatTabNav, MatTabNavPanel } from "@angular/material/tabs";
import { MatIconModule } from "@angular/material/icon";
import { routes } from "../routes";
import { HeaderComponent } from "@components/header/header.component";
import { HolderKeysCardComponent } from "@components/holder/holder.component";
import { CommonModule } from '@angular/common';
import { DrawerService } from "@services/drawer.service";

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
        HolderKeysCardComponent,
        CommonModule,
        MatIconModule
    ]
})
export class AppComponent {
    public routes = routes;
    private drawerService = inject(DrawerService);

    isWalletInfoDrawerOpen = this.drawerService.getIsWalletInfoDrawerOpen();

    closeDrawer(): void {
        this.drawerService.closeWalletInfoDrawer();
    }
}
