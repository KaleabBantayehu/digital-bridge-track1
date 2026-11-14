import type { JobApplication, JobListing, Lang, OnboardingProfile, SupportFilter } from '@db/shared-schemas';
import { MockApiService } from './MockApiService';

type SyncStep = 'consent' | 'name' | 'contact' | 'dob' | 'identity' | 'support';
type SyncProfile = Pick<OnboardingProfile, 'id' | 'partnerId' | 'lang' | 'revision' | 'updatedAt'>;

interface ApiClientOptions {
  apiUrl?: string;
  partnerId: string;
  onFallback?: () => void;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly mock = new MockApiService();
  private readonly remoteSessionIds = new Map<string, string>();
  private mockMode = false;
  private fallbackNotified = false;

  constructor(private readonly options: ApiClientOptions) {
    this.baseUrl = (options.apiUrl ?? '').replace(/\/+$/, '');
    this.mockMode = !this.baseUrl;
    if (this.mockMode) this.notifyFallback();
  }

  async createSession(lang: Lang, partnerId = this.options.partnerId): Promise<{ id: string }> {
    const response = await this.request<{ id?: unknown }>('/onboarding/sessions', {
      method: 'POST',
      body: JSON.stringify({ lang, partnerId }),
    });
    if (!response) return this.mock.createSession(lang, partnerId);
    if (typeof response.id !== 'string' || response.id.length === 0) {
      throw new TypeError('The onboarding session response did not contain an id.');
    }
    return { id: response.id };
  }

  async saveStep(
    profile: SyncProfile,
    step: SyncStep,
    data: unknown,
    revision = profile.revision,
    clientUpdatedAt = profile.updatedAt,
  ): Promise<unknown> {
    let sessionId = this.remoteSessionIds.get(profile.id);
    if (!sessionId && profile.id.startsWith('local-session')) {
      const session = await this.createSession(profile.lang, profile.partnerId);
      if (this.mockMode) {
        return this.mock.saveStep(profile, step, data, revision, clientUpdatedAt);
      }
      sessionId = session.id;
      this.remoteSessionIds.set(profile.id, sessionId);
    }

    if (this.mockMode) return this.mock.saveStep(profile, step, data, revision, clientUpdatedAt);
    sessionId ??= profile.id;

    const response = await this.request(`/onboarding/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ step, data, revision, clientUpdatedAt }),
    });
    if (response) return response;
    return this.mock.saveStep(profile, step, data, revision, clientUpdatedAt);
  }

  async getJobs(filters: SupportFilter[] = []): Promise<{ jobs: JobListing[]; count: number }> {
    if (this.mockMode) return this.mock.getJobs(filters);
    const query = filters.length ? `?accommodations=${encodeURIComponent(filters.join(','))}` : '';
    const response = await this.request<{ jobs?: JobListing[]; count?: number }>(`/career/jobs${query}`);
    if (!response) return this.mock.getJobs(filters);
    if (!Array.isArray(response.jobs) || typeof response.count !== 'number') {
      throw new TypeError('The career jobs response did not match the API contract.');
    }
    return { jobs: response.jobs, count: response.count };
  }

  async apply(payload: JobApplication): Promise<unknown> {
    const response = await this.request('/career/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response ?? this.mock.apply(payload);
  }

  async createJob(payload: unknown): Promise<unknown> {
    const response = await this.request('/career/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response ?? this.mock.createJob(payload);
  }

  async requestResumeSms(profileId: string): Promise<{ token: string; devLink: string; expiresAt: string }> {
    const response = await this.request<{ token: string; devLink: string; expiresAt: string }>(
      `/onboarding/sessions/${encodeURIComponent(profileId)}/resume-sms`,
      { method: 'POST' },
    );
    return response ?? this.mock.requestResumeSms(profileId);
  }

  async partnerVouch(payload: unknown): Promise<{ status: 'vouched'; reference: string }> {
    const response = await this.request<{ status: 'vouched'; reference: string }>('/onboarding/partner-vouch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response ?? this.mock.partnerVouch(payload);
  }

  async verifyPartnerVoucher(
    referralCode: string,
  ): Promise<{ status: 'vouched' | 'rejected'; reference: string }> {
    const response = await this.request<{ status: 'vouched' | 'rejected'; reference: string }>(
      '/onboarding/partner-vouch',
      {
        method: 'POST',
        body: JSON.stringify({ referralCode }),
      },
    );
    return response ?? this.mock.verifyPartnerVoucher(referralCode);
  }

  async exportMyData(profile: OnboardingProfile): Promise<unknown> {
    const response = await this.request<unknown>('/privacy/export');
    if (response !== null) return response;
    if (this.mockMode) return this.mock.exportMyData(profile);
    throw new TypeError('The privacy export response was empty.');
  }

  async deleteMyData(profile: OnboardingProfile): Promise<void> {
    await this.request('/privacy/data', { method: 'DELETE' });
    if (this.mockMode) await this.mock.deleteMyData(profile);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    if (this.mockMode) return null;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });

      if (response.status >= 500) {
        this.activateMock();
        return null;
      }
      if (!response.ok) {
        throw new ApiRequestError(`The API request failed with status ${response.status}.`, response.status);
      }
      if (response.status === 204) return null;
      return await response.json() as T;
    } catch (error) {
      if (error instanceof ApiRequestError) throw error;
      if (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError')) {
        this.activateMock();
        return null;
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private activateMock(): void {
    this.mockMode = true;
    this.notifyFallback();
  }

  private notifyFallback(): void {
    if (this.fallbackNotified) return;
    this.fallbackNotified = true;
    this.options.onFallback?.();
  }
}
