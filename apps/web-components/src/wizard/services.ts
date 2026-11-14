import type { JobApplication, JobListing, OnboardingProfile } from '@db/shared-schemas';
import { SEED_JOBS } from '../career/seedJobs';

/**
 * Dev 2's data contract. TEMPORARY local implementation until Dev 1's ApiClient
 * (src/api/ApiClient.ts, with automatic MockApiService fallback) lands. Then swap
 * `localServices` for an ApiClient-backed object of the same shape. Components never call fetch().
 *
 * Privacy: job filtering happens on this device only; filter values are never sent anywhere.
 */
export interface Dev2Services {
  requestResumeSms(profile: OnboardingProfile): Promise<{ code: string; expiresAt: string; devLink: string }>;
  restoreFromCode(code: string): Promise<{ ok: true; profile: OnboardingProfile } | { ok: false; code: 'TOKEN_EXPIRED' | 'TOKEN_USED' }>;
  requestPartnerVouch(input: { partnerId: string; agentId: string; profileId: string }): Promise<{ referralCode: string; status: 'vouched' }>;
  listJobs(): Promise<JobListing[]>;
  postJob(input: Omit<JobListing, 'id' | 'createdAt'>): Promise<JobListing>;
  submitApplication(input: Omit<JobApplication, 'id' | 'submittedAt'>): Promise<JobApplication>;
  deleteAllData(profileId: string): Promise<void>;
}

const RESUME_PREFIX = 'db:resume:';
const JOBS_KEY = 'db:career:posted-jobs';
const APPS_KEY = 'db:career:applications';
const DAY_MS = 24 * 60 * 60 * 1000;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

function randomCode(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I: easier to read aloud and type
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

const newId = (prefix: string) => `${prefix}-${randomCode(10).toLowerCase()}`;

export const localServices: Dev2Services = {
  async requestResumeSms(profile) {
    const code = `DB-${randomCode()}`;
    const expiresAt = new Date(Date.now() + DAY_MS).toISOString();
    writeJson(RESUME_PREFIX + code, { profile, expiresAt, used: false });
    const base = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '';
    return { code, expiresAt, devLink: `${base}?resume=${encodeURIComponent(code)}` };
  },

  async restoreFromCode(rawCode) {
    const code = rawCode.trim().toUpperCase();
    const entry = readJson<{ profile: OnboardingProfile; expiresAt: string; used: boolean } | null>(RESUME_PREFIX + code, null);
    if (!entry) return { ok: false, code: 'TOKEN_EXPIRED' };
    if (entry.used) return { ok: false, code: 'TOKEN_USED' };
    if (Date.parse(entry.expiresAt) < Date.now()) return { ok: false, code: 'TOKEN_EXPIRED' };
    writeJson(RESUME_PREFIX + code, { ...entry, used: true }); // single use
    return { ok: true, profile: entry.profile };
  },

  async requestPartnerVouch() {
    return { referralCode: `VCH-${randomCode()}`, status: 'vouched' };
  },

  async listJobs() {
    return [...readJson<JobListing[]>(JOBS_KEY, []), ...SEED_JOBS];
  },

  async postJob(input) {
    const job: JobListing = { ...input, id: newId('job'), createdAt: new Date().toISOString() };
    writeJson(JOBS_KEY, [job, ...readJson<JobListing[]>(JOBS_KEY, [])]);
    return job;
  },

  async submitApplication(input) {
    const application: JobApplication = { ...input, id: newId('app'), submittedAt: new Date().toISOString() };
    writeJson(APPS_KEY, [...readJson<JobApplication[]>(APPS_KEY, []), application]);
    return application;
  },

  async deleteAllData() {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('db:') && key !== JOBS_KEY) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
    } catch {
      /* storage blocked: nothing stored */
    }
    try {
      const { clear } = await import('idb-keyval');
      await clear();
    } catch {
      /* IndexedDB unavailable */
    }
  },
};
