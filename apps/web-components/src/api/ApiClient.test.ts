import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingProfile } from '@db/shared-schemas';
import { ApiClient } from './ApiClient';
import { MockApiService } from './MockApiService';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function makeProfile(id = 'profile-123'): OnboardingProfile {
  return {
    id,
    partnerId: 'alx-demo',
    lang: 'en',
    consent: {
      saveAnswers: true,
      smsResume: true,
      shareWithEmployers: false,
      givenAt: new Date().toISOString(),
    },
    name: { givenName: 'Hana', familyName: 'Bekele' },
    contact: { phone: '0911 234 567' },
    progress: { currentStep: 2, totalSteps: 6, completedSteps: [0, 1] },
    revision: 3,
    updatedAt: new Date().toISOString(),
  };
}

describe('ApiClient mock fallback', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: new MemoryStorage(),
      location: { origin: 'https://demo.example.test' },
      setTimeout: (callback: TimerHandler, delay?: number) => globalThis.setTimeout(callback, delay),
      clearTimeout: (timer: number | undefined) => globalThis.clearTimeout(timer),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses the deterministic eight-job Addis mock when no API URL is set', async () => {
    const onFallback = vi.fn();
    const client = new ApiClient({ partnerId: 'alx-demo', onFallback });
    expect(client.isOffline).toBe(true);
    const result = await client.getJobs();
    const remoteJobs = await client.getJobs(['remote']);

    expect(result.count).toBe(8);
    expect(result.jobs).toHaveLength(8);
    expect(result.jobs.every((job) => job.location.includes('Addis Ababa') || job.remote)).toBe(true);
    expect(remoteJobs.jobs.every((job) => job.remote)).toBe(true);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it('switches to mock mode after a network timeout and notifies the host once', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }),
      ),
    );
    const onFallback = vi.fn();
    const client = new ApiClient({ apiUrl: 'https://api.example.test/api/v1', partnerId: 'alx-demo', onFallback });
    expect(client.isOffline).toBe(false);

    const pendingJobs = client.getJobs();
    await vi.advanceTimersByTimeAsync(4_000);
    const result = await pendingJobs;

    expect(result.count).toBe(8);
    expect(client.isOffline).toBe(true);
    expect(onFallback).toHaveBeenCalledTimes(1);
    await client.getJobs();
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back after an API server failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    const client = new ApiClient({
      apiUrl: 'https://api.example.test/api/v1',
      partnerId: 'alx-demo',
    });

    await expect(client.getJobs()).resolves.toMatchObject({ count: 8 });
  });

  it('creates a mock resume link that expires after 24 hours', async () => {
    const client = new ApiClient({ partnerId: 'alx-demo' });
    const profile = makeProfile();
    const result = await client.requestResumeSms(profile);

    expect(result.token).toMatch(/^mock-profile-123-/);
    expect(result.devLink).toBe(`https://demo.example.test/?resumeToken=${encodeURIComponent(result.token)}`);
    expect(Date.parse(result.expiresAt) - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(Date.parse(result.expiresAt) - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    await expect(client.restoreFromResumeCode(result.token)).resolves.toEqual({ ok: true, profile });
    await expect(client.restoreFromResumeCode(result.token)).resolves.toEqual({ ok: false, code: 'TOKEN_USED' });
  });

  it('creates typed mock job listings and applications', async () => {
    const client = new ApiClient({ partnerId: 'alx-demo' });
    const job = await client.createJob({
      title: 'Accessible Support Assistant',
      employer: 'Addis Learning Hub',
      location: 'Addis Ababa',
      remote: false,
      description: 'Support learners with accessible written guidance.',
      offeredAccommodations: ['written_not_phone'],
    });
    const application = await client.apply({
      jobId: job.id,
      applicantProfileId: 'profile-123',
      answers: [],
    });

    const jobs = await client.getJobs();
    expect(jobs.count).toBe(9);
    expect(jobs.jobs.some((listedJob) => listedJob.id === job.id)).toBe(true);
    expect(application).toMatchObject({ jobId: job.id, applicantProfileId: 'profile-123' });
    expect(application.id).toBeTruthy();
    expect(application.submittedAt).toBeTruthy();
  });

  it('only verifies voucher references generated by the mock service', async () => {
    const client = new ApiClient({ partnerId: 'alx-demo' });
    const issued = await client.partnerVouch({
      profile: makeProfile(),
      partnerOrg: 'AAAPD',
      agentName: 'Hana',
    });

    await expect(client.verifyPartnerVoucher(issued.reference)).resolves.toEqual({
      status: 'vouched',
      reference: issued.reference,
    });
    await expect(client.verifyPartnerVoucher('VOUCH-UNKNOWN')).resolves.toEqual({
      status: 'rejected',
      reference: 'VOUCH-UNKNOWN',
    });
  });

  it('maps a consented partner vouch to the REST API contract', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        sessionId: 'profile-123',
        partnerOrg: 'AAAPD',
        agentName: 'Hana',
        learnerConsentConfirmed: true,
      });
      return new Response(JSON.stringify({ voucherId: 'VOUCH-1234ABCD', verified: true }), { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new ApiClient({ apiUrl: 'https://api.example.test/api/v1', partnerId: 'alx-demo' });

    await expect(
      client.partnerVouch({ profile: makeProfile(), partnerOrg: 'AAAPD', agentName: 'Hana' }),
    ).resolves.toEqual({ status: 'vouched', reference: 'VOUCH-1234ABCD' });
  });

  it('provides schema.org metadata for each seeded mock posting', () => {
    const metadata = new MockApiService().getJobPostingMetadata();

    expect(metadata).toHaveLength(8);
    expect(metadata.every((posting) => posting['@context'] === 'https://schema.org')).toBe(true);
    expect(metadata.every((posting) => posting['@type'] === 'JobPosting')).toBe(true);
  });
});
