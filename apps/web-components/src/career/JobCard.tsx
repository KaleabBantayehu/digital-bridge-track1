import React from 'react';
import { Briefcase, CheckCircle2, Home, MapPin } from 'lucide-react';
import type { JobListing, Lang } from '@db/shared-schemas';
import { supportLabel, t } from '../i18n';
import { ReadAloudButton } from '../tts/ReadAloudButton';
import { cleanId, ui } from '../wizard/ui';
import { detectLang, jobLocation, jobTitle } from './jobText';

export interface JobCardProps {
  job: JobListing;
  lang: Lang;
  applied: boolean;
  onApply: (job: JobListing, opener: HTMLButtonElement) => void;
  announce: (message: string) => void;
}

/** One job: <article> named by its <h3>, accommodations as a list, descriptive Apply button (WCAG 1.3.1, 2.4.4). */
export const JobCard: React.FC<JobCardProps> = ({ job, lang, applied, onApply, announce }) => {
  const title = jobTitle(job, lang);
  const location = jobLocation(job, lang);
  const headingId = `job-${cleanId(job.id)}-title`;
  const offers = job.offeredAccommodations;
  const readText = [
    title.text, job.employer, location.text,
    offers.length ? `${t(lang, 'job.offers')}: ${offers.map((o) => supportLabel(lang, o)).join(', ')}` : '',
    job.description,
  ].filter(Boolean).join('. ');

  return (
    <article aria-labelledby={headingId} className={ui.card}>
      <h3 id={headingId} className="flex items-start gap-2 text-xl font-bold mb-1">
        <Briefcase aria-hidden="true" focusable="false" className="h-6 w-6 shrink-0 mt-1 text-terracotta" />
        <span lang={title.lang}>{title.text}</span>
      </h3>
      <p className="font-semibold" lang={detectLang(job.employer)}>{job.employer}</p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-stone-800">
        <span className="inline-flex items-center gap-1">
          <MapPin aria-hidden="true" focusable="false" className="h-4 w-4 shrink-0" />
          <span lang={location.lang}>{location.text}</span>
        </span>
        {job.remote && (
          <span className="inline-flex items-center gap-1">
            <Home aria-hidden="true" focusable="false" className="h-4 w-4 shrink-0" />
            {t(lang, 'job.remote')}
          </span>
        )}
      </p>
      <p className="mb-3" lang={detectLang(job.description)}>{job.description}</p>

      {offers.length > 0 && (
        <>
          <p className="font-semibold text-sm mb-1">{t(lang, 'job.offers')}</p>
          <ul className="flex flex-wrap gap-2 mb-4">
            {offers.map((o) => (
              <li key={o} className={ui.badge}>
                {supportLabel(lang, o)}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-wrap items-start gap-2">
        <button type="button" onClick={(e) => onApply(job, e.currentTarget)} className={ui.btnPrimary}>
          {t(lang, 'job.apply', { title: title.text, employer: job.employer, location: location.text })}
        </button>
        <ReadAloudButton lang={lang} text={readText} label={t(lang, 'job.readAloud', { title: title.text })} announce={announce} />
        {applied && (
          <p className="inline-flex items-center gap-1 min-h-[44px] font-semibold text-green-800">
            <CheckCircle2 aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {t(lang, 'job.applied')}
          </p>
        )}
      </div>
    </article>
  );
};
