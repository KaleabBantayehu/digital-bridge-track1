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

  get isOffline(): boolean {
    return this.mockMode;
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
    const response = await this.request<unknown>(`/career/jobs${query}`);
    if (!response) return this.mock.getJobs(filters);
    if (Array.isArray(response) && response.every((job) => this.isJobListing(job))) {
      return { jobs: response, count: response.length };
    }
    if (
      typeof response === 'object' &&
      response !== null &&
      'jobs' in response &&
      Array.isArray(response.jobs) &&
      response.jobs.every((job) => this.isJobListing(job)) &&
      'count' in response &&
      typeof response.count === 'number'
    ) {
      return { jobs: response.jobs, count: response.count };
    }
    throw new TypeError('The career jobs response did not match the API contract.');
  }

  async apply(payload: Omit<JobApplication, 'id' | 'submittedAt'>): Promise<JobApplication> {
    const response = await this.request<unknown>('/career/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response) return this.mock.apply(payload);
    if (!this.isJobApplication(response)) {
      throw new TypeError('The application response did not match the API contract.');
    }
    return response;
  }

  async createJob(payload: Omit<JobListing, 'id' | 'createdAt'>): Promise<JobListing> {
    const response = await this.request<unknown>('/career/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response) return this.mock.createJob(payload);
    if (!this.isJobListing(response)) {
      throw new TypeError('The job response did not match the API contract.');
    }
    return response;
  }

  async requestResumeSms(
    profile: OnboardingProfile,
  ): Promise<{ token: string; devLink: string; expiresAt: string }> {
    if (this.mockMode) return this.mock.requestResumeSms(profile);
    const sessionId = await this.ensureRemoteSessionId(profile);
    if (this.mockMode) return this.mock.requestResumeSms(profile);
    const response = await this.request<{ token?: string; devLink: string; expiresAt: string }>(
      `/onboarding/sessions/${encodeURIComponent(sessionId)}/resume-sms`,
      {
        method: 'POST',
        body: JSON.stringify({ phone: profile.contact.phone }),
      },
    );
    if (!response) return this.mock.requestResumeSms(profile);
    const token = response.token ?? new URL(response.devLink, window.location.href).searchParams.get('resumeToken');
    if (!token) throw new TypeError('The resume SMS response did not contain a token.');
    return { ...response, token };
  }

  async restoreFromResumeCode(
    token: string,
  ): Promise<{ ok: true; profile: OnboardingProfile } | { ok: false; code: 'TOKEN_EXPIRED' | 'TOKEN_USED' }> {
    if (this.mockMode) return this.mock.restoreFromResumeToken(token);
    try {
      const profile = await this.request<OnboardingProfile>(`/onboarding/resume/${encodeURIComponent(token)}`);
      if (!profile) return this.mock.restoreFromResumeToken(token);
      return { ok: true, profile };
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 410) {
        return { ok: false, code: 'TOKEN_EXPIRED' };
      }
      throw error;
    }
  }

  async partnerVouch(input: {
    profile: OnboardingProfile;
    partnerOrg: string;
    agentName: string;
  }): Promise<{ status: 'vouched'; reference: string }> {
    const mockPayload = {
      partnerOrg: input.partnerOrg,
      agentName: input.agentName,
      profileId: input.profile.id,
      learnerConsentConfirmed: true,
    };
    if (this.mockMode) return this.mock.partnerVouch(mockPayload);

    const sessionId = await this.ensureRemoteSessionId(input.profile);
    if (this.mockMode) return this.mock.partnerVouch(mockPayload);
    const response = await this.request<{ voucherId?: unknown }>('/onboarding/partner-vouch', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        partnerOrg: input.partnerOrg,
        agentName: input.agentName,
        learnerConsentConfirmed: true,
      }),
    });
    if (!response) return this.mock.partnerVouch(mockPayload);
    if (typeof response.voucherId !== 'string' || response.voucherId.length === 0) {
      throw new TypeError('The partner voucher response did not contain a voucher id.');
    }
    return { status: 'vouched', reference: response.voucherId };
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

  private async ensureRemoteSessionId(profile: OnboardingProfile): Promise<string> {
    let sessionId = this.remoteSessionIds.get(profile.id);
    if (!sessionId && profile.id.startsWith('local-session')) {
      const session = await this.createSession(profile.lang, profile.partnerId);
      if (this.mockMode) return profile.id;
      sessionId = session.id;
      this.remoteSessionIds.set(profile.id, sessionId);
    }
    return sessionId ?? profile.id;
  }

  private isJobListing(value: unknown): value is JobListing {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      typeof value.id === 'string' &&
      'title' in value &&
      (typeof value.title === 'string' || (typeof value.title === 'object' && value.title !== null)) &&
      'employer' in value &&
      typeof value.employer === 'string' &&
      'location' in value &&
      typeof value.location === 'string' &&
      'remote' in value &&
      typeof value.remote === 'boolean' &&
      'description' in value &&
      typeof value.description === 'string' &&
      'offeredAccommodations' in value &&
      Array.isArray(value.offeredAccommodations) &&
      'createdAt' in value &&
      typeof value.createdAt === 'string'
    );
  }

  private isJobApplication(value: unknown): value is JobApplication {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      typeof value.id === 'string' &&
      'jobId' in value &&
      typeof value.jobId === 'string' &&
      'applicantProfileId' in value &&
      typeof value.applicantProfileId === 'string' &&
      'answers' in value &&
      Array.isArray(value.answers) &&
      'submittedAt' in value &&
      typeof value.submittedAt === 'string'
    );
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
