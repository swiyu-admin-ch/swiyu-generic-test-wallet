import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DrawerService } from '@services/drawer.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  private drawerService = inject(DrawerService);

  appVersion = '0.0.1';
  githubUrl = 'https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet';
  guideUrl = 'https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet/blob/main/GUIDE.md';

  openGithub(): void {
    window.open(this.githubUrl, '_blank');
  }

  openGuide(): void {
    window.open(this.guideUrl, '_blank');
  }

  toggleWalletInfo(): void {
    this.drawerService.toggleWalletInfoDrawer();
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

