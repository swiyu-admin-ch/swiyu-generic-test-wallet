import {Component, input, InputSignal} from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {NgStyle} from "@angular/common";
import {MatListItem} from "@angular/material/list";

@Component({
    selector: 'app-checklist-entry',
    imports: [
        MatIcon,
        NgStyle,
        MatListItem
    ],
    templateUrl: './checklist-entry.html',
    standalone: true
})
export class ChecklistEntry {
    data: InputSignal<any> = input.required();
    validData: InputSignal<any> = input.required();
    text: InputSignal<string> = input.required();
}
