import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatIcon} from "@angular/material/icon";

@Component({
    selector: 'app-metadata-panel',
    templateUrl: './panel.component.html',
    standalone: true,
    imports: [CommonModule, MatExpansionModule, MatIcon],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PanelComponent {
    @Input() panelOpenState: boolean;
    @Input() panelTitle: string;
    @Input() data: any = undefined;
}
