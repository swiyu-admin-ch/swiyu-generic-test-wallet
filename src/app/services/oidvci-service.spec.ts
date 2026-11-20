import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { OIDVCIService } from './oidvci-service';

describe('OIDVCIService - fetchRegistryEntry', () => {
  let service: OIDVCIService;
  let httpTesting: HttpTestingController;

  const DID_LOG_URL = 'https://registry.example.com/did.jsonl';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OIDVCIService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should return the entry of a single line DID log', async () => {
    const entry = firstValueFrom(service.fetchRegistryEntry(DID_LOG_URL));
    httpTesting.expectOne(DID_LOG_URL).flush('{"versionId":"1-abc"}\n');

    expect(await entry).toEqual({ versionId: '1-abc' });
  });

  it('should return the last entry of a multi line DID log', async () => {
    const entry = firstValueFrom(service.fetchRegistryEntry(DID_LOG_URL));
    httpTesting.expectOne(DID_LOG_URL).flush('{"versionId":"1-abc"}\n{"versionId":"2-def"}');

    expect(await entry).toEqual({ versionId: '2-def' });
  });
});
