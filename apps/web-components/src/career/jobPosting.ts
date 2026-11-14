import type { JobListing, Lang } from '@db/shared-schemas';
import { supportLabel } from '../i18n';
import { jobLocation, jobTitle } from './jobText';

/**
 * schema.org/JobPosting objects for the listed jobs (Technical Guide v2 §7). Same shape the API serves, so any
 * scraper that reads the component's DOM sees valid postings. Accessibility offers go in `jobBenefits`
 * (schema.org has no dedicated accommodation property). Never includes the candidate's private filters.
 */
export function toJobPosting(job: JobListing, lang: Lang) {
  const title = jobTitle(job, lang).text;
  const locality = jobLocation(job, 'en').text;
  const accommodations = job.offeredAccommodations.map((a) => supportLabel('en', a));
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    identifier: { '@type': 'PropertyValue', name: job.employer, value: job.id },
    title,
    description: job.description,
    datePosted: job.createdAt.slice(0, 10),
    ...(job.deadlineIso ? { validThrough: job.deadlineIso } : {}),
    hiringOrganization: { '@type': 'Organization', name: job.employer },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: locality, addressCountry: 'ET' },
    },
    ...(job.remote
      ? { jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { '@type': 'Country', name: 'Ethiopia' } }
      : {}),
    ...(accommodations.length ? { jobBenefits: `Workplace accessibility: ${accommodations.join('; ')}` } : {}),
    directApply: true,
  };
}

/** JSON for a <script type="application/ld+json">. `<` is escaped so text can never close the script element. */
export const jobPostingsJsonLd = (jobs: JobListing[], lang: Lang) =>
  JSON.stringify(jobs.map((job) => toJobPosting(job, lang))).replace(/</g, '\u003c');
