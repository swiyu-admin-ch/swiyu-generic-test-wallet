import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Credential } from './credential';

describe('Credential', () => {
  let component: Credential;
  let fixture: ComponentFixture<Credential>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Credential]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Credential);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
