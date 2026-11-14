import type { JobApplication, JobListing, Lang, OnboardingProfile, SupportFilter } from '@db/shared-schemas';

const jobs: JobListing[] = [
  {
    id: 'mock-job-1',
    title: { en: 'Customer Support Agent', am: 'የደንበኛ ድጋፍ ሰጪ' },
    employer: 'Acme Telecom',
    location: 'Addis Ababa',
    remote: false,
    description: 'Support customers by chat and email with clear written guidance.',
    offeredAccommodations: ['written_not_phone', 'extra_time', 'high_contrast_large_text'],
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'mock-job-2',
    title: { en: 'Junior Data Assistant', am: 'ጀማሪ የዳታ ረዳት' },
    employer: 'Ethio Digital',
    location: 'Addis Ababa',
    remote: true,
    description: 'Organize spreadsheets and prepare accessible weekly reports.',
    offeredAccommodations: ['screen_reader_materials', 'flexible_hours', 'remote'],
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'mock-job-3',
    title: { en: 'Office Administrator', am: 'የቢሮ አስተዳዳሪ' },
    employer: 'Habesha Learning',
    location: 'Bole, Addis Ababa',
    remote: false,
    description: 'Coordinate schedules, written communication, and learner records.',
    offeredAccommodations: ['step_free_venue', 'written_not_phone', 'quiet_workspace'],
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'mock-job-4',
    title: { en: 'Accessible Content Reviewer', am: 'ተደራሽ ይዘት ገምጋሚ' },
    employer: 'Digital Bridge',
    location: 'Remote',
    remote: true,
    description: 'Review learning materials for clarity, keyboard access, and captions.',
    offeredAccommodations: ['screen_reader_materials', 'sign_language_captions', 'remote', 'flexible_hours'],
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'mock-job-5',
    title: { en: 'Digital Skills Tutor', am: 'የዲጂታል ክህሎት አስተማሪ' },
    employer: 'Addis Learning Hub',
    location: 'Piassa, Addis Ababa',
    remote: false,
    description: 'Help new learners practice computer and workplace skills at their own pace.',
    offeredAccommodations: ['extra_time', 'audio_instructions', 'quiet_workspace'],
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'mock-job-6',
    title: { en: 'Remote Transcription Assistant', am: 'የርቀት ጽሑፍ አዘጋጅ ረዳት' },
    employer: 'Sheger Media',
    location: 'Remote',
    remote: true,
    description: 'Prepare and proofread written transcripts using supplied templates.',
    offeredAccommodations: ['written_not_phone', 'remote', 'flexible_hours'],
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'mock-job-7',
    title: { en: 'Customer Care Associate', am: 'የደንበኛ እንክብካቤ ባለሙያ' },
    employer: 'Enat Bank',
    location: 'Kirkos, Addis Ababa',
    remote: false,
    description: 'Answer customer questions in person and through accessible digital channels.',
    offeredAccommodations: ['step_free_venue', 'high_contrast_large_text', 'extra_time'],
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'mock-job-8',
    title: { en: 'Quality Assurance Trainee', am: 'የጥራት ማረጋገጫ ሰልጣኝ' },
    employer: 'Blue Nile Software',
    location: 'Bole, Addis Ababa',
    remote: true,
    description: 'Test learning applications and document issues with clear steps.',
    offeredAccommodations: ['screen_reader_materials', 'high_contrast_large_text', 'remote', 'flexible_hours'],
    createdAt: '2026-01-10T00:00:00.000Z',
  },
];

export interface MockJobPostingMetadata {
  '@context': 'https://schema.org';
  '@type': 'JobPosting';
  title: string;
  description: string;
  datePosted: string;
  hiringOrganization: { '@type': 'Organization'; name: string };
  jobLocation?: { '@type': 'Place'; address: { '@type': 'PostalAddress'; addressLocality: string; addressCountry: 'ET' } };
  jobLocationType?: 'TELECOMMUTE';
}

function toJobPostingMetadata(job: JobListing): MockJobPostingMetadata {
  const title = typeof job.title === 'string' ? job.title : job.title.en;
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title,
    description: job.description,
    datePosted: job.createdAt,
    hiringOrganization: { '@type': 'Organization', name: job.employer },
    ...(job.remote
      ? { jobLocationType: 'TELECOMMUTE' as const }
      : {
          jobLocation: {
            '@type': 'Place' as const,
            address: {
              '@type': 'PostalAddress' as const,
              addressLocality: job.location.replace(/,? Addis Ababa$/, ''),
              addressCountry: 'ET' as const,
            },
          },
        }),
  };
}

const supportFilters: SupportFilter[] = [
  'screen_reader_materials',
  'sign_language_captions',
  'step_free_venue',
  'extra_time',
  'high_contrast_large_text',
  'audio_instructions',
  'written_not_phone',
  'quiet_workspace',
  'other',
  'remote',
  'flexible_hours',
  'wheelchair_accessible_office',
  'screen_reader_software',
];

function isSupportFilter(value: unknown): value is SupportFilter {
  return supportFilters.some((filter) => filter === value);
}

function isJobApplication(value: unknown): value is JobApplication {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('jobId' in value) ||
    typeof value.jobId !== 'string' ||
    !('applicantProfileId' in value) ||
    typeof value.applicantProfileId !== 'string' ||
    !('submittedAt' in value) ||
    typeof value.submittedAt !== 'string' ||
    !('answers' in value) ||
    !Array.isArray(value.answers)
  ) {
    return false;
  }

  const validAnswers = value.answers.every(
    (answer) =>
      typeof answer === 'object' &&
      answer !== null &&
      'questionId' in answer &&
      typeof answer.questionId === 'string' &&
      'text' in answer &&
      typeof answer.text === 'string' &&
      'inputMode' in answer &&
      (answer.inputMode === 'typed' || answer.inputMode === 'voice') &&
      (!('audioRef' in answer) || typeof answer.audioRef === 'string'),
  );
  if (!validAnswers) return false;
  if (!('adjustmentRequest' in value) || value.adjustmentRequest === undefined) return true;

  const adjustment = value.adjustmentRequest;
  return (
    typeof adjustment === 'object' &&
    adjustment !== null &&
    'items' in adjustment &&
    Array.isArray(adjustment.items) &&
    adjustment.items.every(isSupportFilter) &&
    (!('note' in adjustment) || typeof adjustment.note === 'string') &&
    'shareConsent' in adjustment &&
    adjustment.shareConsent === true
  );
}

function localStorageOrThrow(): Storage {
  if (typeof window === 'undefined') throw new Error('Mock mode requires a browser storage provider.');
  try {
    return window.localStorage;
  } catch (error) {
    throw new Error('Mock mode cannot access browser storage.', { cause: error });
  }
}

export class MockApiService {
  private get storage(): Storage {
    return localStorageOrThrow();
  }

  async createSession(lang: Lang, partnerId: string): Promise<{ id: string }> {
    const key = `db:mock-session:${partnerId}:${lang}`;
    const id = this.storage.getItem(key) ?? `mock-${partnerId}-${lang}-session`;
    this.storage.setItem(key, id);
    return { id };
  }

  async saveStep(
    profile: Pick<OnboardingProfile, 'id' | 'partnerId' | 'lang'>,
    step: string,
    data: unknown,
    revision: number,
    clientUpdatedAt: string,
  ): Promise<{ id: string; step: string; revision: number }> {
    const key = `db:mock-profile:${profile.partnerId}:${profile.id}`;
    const raw = this.storage.getItem(key);
    const saved: Record<string, unknown> = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    const savedRevision = typeof saved.revision === 'number' ? saved.revision : 0;
    const nextRevision = Math.max(revision, savedRevision + 1);
    saved[step] = data;
    saved.revision = nextRevision;
    saved.clientUpdatedAt = clientUpdatedAt;
    this.storage.setItem(key, JSON.stringify(saved));
    return { id: profile.id, step, revision: nextRevision };
  }

  async getJobs(filters: SupportFilter[] = []): Promise<{ jobs: JobListing[]; count: number }> {
    const filteredJobs = jobs.filter((job) => filters.every((filter) => job.offeredAccommodations.includes(filter)));
    return { jobs: filteredJobs, count: filteredJobs.length };
  }

  getJobPostingMetadata(): MockJobPostingMetadata[] {
    return jobs.map(toJobPostingMetadata);
  }

  async apply(payload: JobApplication): Promise<{ id: string; submitted: true }> {
    const id = `mock-application-${Date.now()}`;
    this.storage.setItem(`db:mock-application:${id}`, JSON.stringify(payload));
    return { id, submitted: true };
  }

  async createJob(payload: unknown): Promise<{ id: string; created: true }> {
    const id = `mock-job-created-${Date.now()}`;
    this.storage.setItem(`db:mock-job:${id}`, JSON.stringify(payload));
    return { id, created: true };
  }

  async requestResumeSms(
    profileId: string,
  ): Promise<{ token: string; devLink: string; expiresAt: string }> {
    const token = `mock-${profileId}-${Date.now()}`;
    return {
      token,
      devLink: `${window.location.origin}/?resumeToken=${encodeURIComponent(token)}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async partnerVouch(payload: unknown): Promise<{ status: 'vouched'; reference: string }> {
    const reference = `VOUCH-${Date.now()}`;
    this.storage.setItem(`db:mock-vouch:${reference}`, JSON.stringify(payload));
    return { status: 'vouched', reference };
  }

  async verifyPartnerVoucher(
    referralCode: string,
  ): Promise<{ status: 'vouched' | 'rejected'; reference: string }> {
    const validCode = /^VOUCH-[A-Z0-9-]+$/i.test(referralCode);
    const exists = validCode && this.storage.getItem(`db:mock-vouch:${referralCode}`) !== null;
    return { status: exists ? 'vouched' : 'rejected', reference: referralCode };
  }

  async exportMyData(profile: OnboardingProfile): Promise<{ profile: OnboardingProfile; applications: JobApplication[] }> {
    const applications: JobApplication[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key?.startsWith('db:mock-application:')) continue;
      const value: unknown = JSON.parse(this.storage.getItem(key) ?? 'null');
      if (isJobApplication(value) && value.applicantProfileId === profile.id) applications.push(value);
    }
    return { profile, applications };
  }

  async deleteMyData(profile: OnboardingProfile): Promise<void> {
    this.storage.removeItem(`db:mock-profile:${profile.partnerId}:${profile.id}`);
    const applicationKeys: string[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key?.startsWith('db:mock-application:')) continue;
      const value: unknown = JSON.parse(this.storage.getItem(key) ?? 'null');
      if (isJobApplication(value) && value.applicantProfileId === profile.id) applicationKeys.push(key);
    }
    applicationKeys.forEach((key) => this.storage.removeItem(key));
  }
}
