import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIcon } from "@angular/material/icon";
import { WritableSignal } from '@angular/core';

@Component({
    selector: 'app-validation-panel',
    templateUrl: './validation-panel.component.html',
    styleUrl: './validation-panel.component.css',
    standalone: true,
    imports: [CommonModule, MatExpansionModule, MatIcon],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ValidationPanelComponent {
    @Input() panelOpenState: WritableSignal<boolean> | undefined;
    @Input() panelTitle: string | undefined;
    @Input() data: unknown | undefined = undefined;
    @Input() errorMessage: Record<string, any> | string | undefined = undefined;

    isObject(value: unknown): value is Record<string, any> {
        return typeof value === 'object' && value !== null;
    }
}
