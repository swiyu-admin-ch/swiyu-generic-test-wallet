import { TestBed } from '@angular/core/testing';

import { ErrorFormatterService } from './error-formatter-service';

describe('ErrorFormatterService', () => {
  let service: ErrorFormatterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ErrorFormatterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
