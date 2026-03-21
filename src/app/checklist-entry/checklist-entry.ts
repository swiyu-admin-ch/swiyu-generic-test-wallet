import { Component, computed, input, InputSignal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatListItem } from '@angular/material/list';
import { MatTooltip } from '@angular/material/tooltip';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-checklist-entry',
  standalone: true,
  imports: [MatIcon, MatTooltip, MatListItem, NgClass],
  templateUrl: './checklist-entry.html',
  styleUrl: './checklist-entry.css'
})
export class ChecklistEntry {

  data: InputSignal<unknown> = input.required();
  validData: InputSignal<boolean> = input.required();
  text: InputSignal<string> = input.required();
  optional = input<string | null>(null);

  icon = computed(() => {
    if (!this.data()) return 'circle';
    return this.validData() ? 'check_circle' : 'cancel';
  });

  iconClass = computed(() => {
  if (!this.data()) return 'icon--pending';

  if (this.validData()) return 'icon--valid';

  return this.optional() !== null ? 'icon--optional' : 'icon--invalid';
});

}