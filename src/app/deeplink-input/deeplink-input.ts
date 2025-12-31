import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule, NgForm, ReactiveFormsModule} from "@angular/forms";
import {MatButton} from "@angular/material/button";
import {MatFormField} from "@angular/material/form-field";
import {MatInput} from "@angular/material/input";

@Component({
    selector: 'app-deeplink-input',
    imports: [
        FormsModule,
        MatButton,
        MatFormField,
        MatInput,
        ReactiveFormsModule
    ],
    templateUrl: './deeplink-input.html',
    styleUrls: ['./deeplink-input.css'],
    standalone: true
})
export class DeeplinkInput {
    @Input() input;
    @Output() inputChangeEvent = new EventEmitter<string>();

    public onSubmit(f: NgForm): void {
        console.log('Deeplink submitted:', this.input);
        this.inputChangeEvent.emit(this.input);
    }

    public reset(): void {
        this.input = '';
        this.inputChangeEvent.emit(this.input);
    }
}
