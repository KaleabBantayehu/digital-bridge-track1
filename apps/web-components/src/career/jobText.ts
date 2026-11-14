import type { JobListing, Lang, SupportFilter } from '@db/shared-schemas';
import { t, type I18nKey } from '../i18n';
import { LOCATION_KEYS } from './seedJobs';

/** Ethiopic script => Amharic, otherwise treat free text as English (for the lang attribute, WCAG 3.1.2). */
export const detectLang = (text: string): Lang => (/[ሀ-፿]/.test(text) ? 'am' : 'en');

export function jobTitle(job: JobListing, lang: Lang): { text: string; lang: Lang } {
  if (typeof job.title === 'string') return { text: job.title, lang: detectLang(job.title) };
  return { text: job.title[lang], lang };
}

export function jobLocation(job: JobListing, lang: Lang): { text: string; lang: Lang } {
  if ((LOCATION_KEYS as readonly string[]).includes(job.location)) return { text: t(lang, `loc.${job.location}` as I18nKey), lang };
  return { text: job.location, lang: detectLang(job.location) };
}

/** Filters a candidate can use. Workplace-level filters first, then the onboarding support needs. */
export const CAREER_FILTERS: SupportFilter[] = [
  'remote', 'flexible_hours', 'wheelchair_accessible_office', 'screen_reader_software',
  'screen_reader_materials', 'sign_language_captions', 'step_free_venue', 'extra_time',
  'high_contrast_large_text', 'audio_instructions', 'written_not_phone', 'quiet_workspace',
];

export function jobOffers(job: JobListing, filter: SupportFilter): boolean {
  return job.offeredAccommodations.includes(filter) || (filter === 'remote' && job.remote);
}
