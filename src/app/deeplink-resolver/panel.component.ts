import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatIcon} from "@angular/material/icon";
import { WritableSignal } from '@angular/core';

@Component({
    selector: 'app-metadata-panel',
    templateUrl: './panel.component.html',
    standalone: true,
    imports: [CommonModule, MatExpansionModule, MatIcon],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PanelComponent {
    @Input() panelOpenState: WritableSignal<boolean> | undefined;
    @Input() panelTitle: string;
    @Input() data: Record<string, unknown> | undefined = undefined;
}
