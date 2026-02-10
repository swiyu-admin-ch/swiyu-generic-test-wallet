import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatButton} from "@angular/material/button";
import {MatFormField, MatFormFieldModule} from "@angular/material/form-field";
import {MatInput, MatInputModule} from "@angular/material/input";

@Component({
    selector: 'app-deeplink-input',
    imports: [
        FormsModule,
        MatButton,
        MatFormField,
        MatInput,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
    ],
    templateUrl: './deeplink-input.html',
    styleUrls: ['./deeplink-input.css'],
    standalone: true
})
export class DeeplinkInput {
    @Input() input: string;
    @Input() label: string;
    @Output() submitEvent = new EventEmitter<string>();
    @Output() resetEvent = new EventEmitter();

    public onSubmit(): void {
        this.submitEvent.emit(this.input);
    }

    public reset(): void {
        this.resetEvent.emit();
    }
}
