import { Component, input, InputSignal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-json-viewer',
  standalone: true,
  imports: [MatIcon, MatIconButton, JsonPipe],
  templateUrl: './json-viewer.html',
  styleUrl: './json-viewer.css'
})
export class JsonViewer {

  data: InputSignal<unknown> = input.required();

  copy() {
    const json = JSON.stringify(this.data(), null, 2);
    navigator.clipboard.writeText(json);
  }

}