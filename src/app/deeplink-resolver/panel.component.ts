import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIcon } from "@angular/material/icon";
import { WritableSignal } from '@angular/core';

@Component({
    selector: 'app-metadata-panel',
    templateUrl: './panel.component.html',
    styleUrl: './panel.component.css',
    standalone: true,
    imports: [CommonModule, MatExpansionModule, MatIcon],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PanelComponent {
    @Input() panelOpenState: WritableSignal<boolean> | undefined;
    @Input() panelTitle: string | undefined;
    @Input() data: Record<string, unknown> | undefined = undefined;
    @Input() errorMessage: Record<string, any> | string | undefined = undefined;

    isObject(value: unknown): value is Record<string, any> {
        return typeof value === 'object' && value !== null;
    }
}
