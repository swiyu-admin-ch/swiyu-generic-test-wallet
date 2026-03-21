import {Component, EventEmitter, Input, Output, WritableSignal, signal} from '@angular/core';
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
    standalone: true
})
export class DeeplinkInput {
    @Input() inputSignal: WritableSignal<string> = signal('');
    @Input() label: string | undefined;
    @Output() submitEvent = new EventEmitter<string>();
    @Output() resetEvent = new EventEmitter();

    get input(): string {
        return this.inputSignal();
    }

    set input(value: string) {
        this.inputSignal.set(value);
    }

    public onSubmit(): void {
        this.submitEvent.emit(this.input);
    }

    public reset(): void {
        this.inputSignal.set('');
        this.resetEvent.emit();
    }
}


