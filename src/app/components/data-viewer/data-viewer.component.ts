import { Component, inject, input, InputSignal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { JsonPipe } from '@angular/common';
import { ToastService } from '@app/services/toast.service';

@Component({
  selector: 'app-data-viewer',
  standalone: true,
  imports: [MatIcon, MatIconButton, JsonPipe],
  templateUrl: './data-viewer.component.html',
  styleUrl: './data-viewer.component.css'
})
export class DataViewerComponent {
  private toastService = inject(ToastService);
  
  data: InputSignal<unknown> = input.required();
  title: InputSignal<string | undefined> = input();
  maxLength: InputSignal<number | undefined> = input();

  copy() {
    const json = JSON.stringify(this.data(), null, 2);
    navigator.clipboard.writeText(json);

    this.toastService.showSuccess(`${this.title() ? this.title() : 'Data'} copied to the clipboard`);
  }

  get displayedJson(): string {
    const json = JSON.stringify(this.data(), null, 2);

    const max = this.maxLength();
    if (!max || json.length <= max) {
      return json;
    }

    return json.slice(0, max) + '...';
  }

}