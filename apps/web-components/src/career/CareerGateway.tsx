import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Briefcase, Building2, EyeOff, Search } from 'lucide-react';
import { DB_EVENTS, type JobListing, type Lang, type SupportFilter } from '@db/shared-schemas';
import { useOnboardingStore } from '../state/store';
import { makeT, supportLabel } from '../i18n';
import { CheckboxField } from '../fields/CheckboxField';
import { LiveRegion, useAnnouncer } from '../wizard/LiveRegion';
import { emitEvent } from '../wizard/emit';
import { localServices, type Dev2Services } from '../wizard/services';
import { cleanId, cx, ui } from '../wizard/ui';
import { ApplyDialog } from './ApplyDialog';
import { EmployerForm } from './EmployerForm';
import { JobCard } from './JobCard';
import { CAREER_FILTERS, jobOffers } from './jobText';

export interface CareerGatewayProps {
  apiUrl?: string;
  partnerId?: string;
  lang?: Lang;
  theme?: "terracotta" | "high-contrast";
  onDispatch?: (eventName: string, detail: unknown) => void;
  /** Optional (additive): inject Dev 1's ApiClient-backed services. Defaults to the local/offline implementation. */
  services?: Dev2Services;
  /** Optional (additive): open on the employer form instead of the job list. */
  initialView?: 'jobs' | 'employer';
}

type View = 'jobs' | 'employer';

export const CareerGateway: React.FC<CareerGatewayProps> = ({
  lang: langProp, theme = 'terracotta', onDispatch, services = localServices, initialView = 'jobs',
}) => {
  const profile = useOnboardingStore((s) => s.profile);
  const updateProfile = useOnboardingStore((s) => s.updateProfile);
  const lang: Lang = langProp ?? profile.lang;
  const t = useMemo(() => makeT(lang), [lang]);
  const { announcement, announce } = useAnnouncer();

  const rootRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const idBase = `career-${cleanId(useId())}`;
  const headingId = `${idBase}-heading`;
  const filterHintId = `${idBase}-filter-hint`;

  const [view, setView] = useState<View>(initialView);
  const [jobs, setJobs] = useState<JobListing[] | null>(null);
  // WCAG 3.3.7: start from the support needs the learner already gave during onboarding.
  const [filters, setFilters] = useState<SupportFilter[]>(() => (profile.support?.needs ?? []).filter((n) => CAREER_FILTERS.includes(n)));
  const [applyingTo, setApplyingTo] = useState<JobListing | null>(null);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const filtersTouched = useRef(false);

  // The store may hydrate from IndexedDB after mount: keep pre-filling until the user changes a filter.
  const needsKey = (profile.support?.needs ?? []).join(',');
  useEffect(() => {
    if (!filtersTouched.current) setFilters((profile.support?.needs ?? []).filter((n) => CAREER_FILTERS.includes(n)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsKey]);

  useEffect(() => {
    let alive = true;
    void services.listJobs().then((list) => {
      if (alive) setJobs(list);
    });
    return () => {
      alive = false;
    };
  }, [services]);

  // Filtering is done on this device only; the selected filters are never sent or logged.
  const visibleJobs = useMemo(
    () => (jobs ?? []).filter((job) => filters.every((f) => jobOffers(job, f))),
    [jobs, filters],
  );

  const dispatch = (name: string, detail: unknown) => emitEvent(onDispatch, rootRef.current, name, detail);

  const toggleFilter = (filter: SupportFilter, on: boolean) => {
    filtersTouched.current = true;
    const next = on ? [...filters, filter] : filters.filter((f) => f !== filter);
    setFilters(next);
    const count = (jobs ?? []).filter((job) => next.every((f) => jobOffers(job, f))).length;
    announce(t('filter.count', { count }));
    dispatch(DB_EVENTS.jobFilterChanged, { resultCount: count }); // never the filter values
  };

  const clearFilters = () => {
    filtersTouched.current = true;
    setFilters([]);
    const count = (jobs ?? []).length;
    announce(t('filter.count', { count }));
    dispatch(DB_EVENTS.jobFilterChanged, { resultCount: count });
  };

  const openApply = (job: JobListing, opener: HTMLButtonElement) => {
    openerRef.current = opener;
    setApplyingTo(job);
  };

  const closeApply = () => {
    setApplyingTo(null);
    openerRef.current?.focus(); // focus returns to the Apply button that opened the dialog
  };

  const switchView = (next: View) => {
    setView(next);
  };

  const highContrast = theme === 'high-contrast';

  return (
    <section
      ref={rootRef}
      lang={lang}
      aria-labelledby={headingId}
      data-theme={theme}
      className={cx(
        'w-full max-w-[56rem] mx-auto p-4 sm:p-6 rounded-lg border-2 font-sans text-base leading-relaxed break-words',
        highContrast ? 'bg-white text-black border-black' : 'bg-parchment text-ink border-terracotta',
      )}
    >
      <LiveRegion announcement={announcement} />

      <h2 id={headingId} tabIndex={-1} className="flex items-center gap-2 text-2xl font-bold mb-1">
        <Briefcase aria-hidden="true" focusable="false" className="h-7 w-7 shrink-0 text-terracotta" />
        {t('career.title')}
      </h2>
      <p className="mb-4">{t('career.intro')}</p>

      <div role="group" aria-label={t('career.viewLabel')} className="mb-6 flex flex-wrap gap-2">
        <button type="button" aria-pressed={view === 'jobs'} onClick={() => switchView('jobs')} className={ui.btnToggle(view === 'jobs')}>
          <Search aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
          {t('career.tabJobs')}
        </button>
        <button type="button" aria-pressed={view === 'employer'} onClick={() => switchView('employer')} className={ui.btnToggle(view === 'employer')}>
          <Building2 aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
          {t('career.tabEmployer')}
        </button>
      </div>

      {view === 'employer' ? (
        <EmployerForm
          lang={lang}
          services={services}
          announce={announce}
          headingLevel={3}
          onPosted={(job) => setJobs((list) => [job, ...(list ?? [])])}
        />
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <fieldset className={cx(ui.fieldset, 'lg:w-80 lg:shrink-0 bg-white')} aria-describedby={filterHintId}>
            <legend className={ui.legend}>{t('filter.legend')}</legend>
            <p id={filterHintId} className="flex items-start gap-2 mb-3 font-semibold">
              <EyeOff aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0 text-terracotta" />
              {t('filter.private')}
            </p>
            {CAREER_FILTERS.map((filter) => (
              <CheckboxField
                key={filter}
                id={`${idBase}-filter-${filter}`}
                label={supportLabel(lang, filter)}
                checked={filters.includes(filter)}
                onChange={(on) => toggleFilter(filter, on)}
              />
            ))}
            {filters.length > 0 && (
              <button type="button" onClick={clearFilters} className={`${ui.btnQuiet} mt-2`}>
                {t('filter.clear')}
              </button>
            )}
          </fieldset>

          <div className="flex-1 min-w-0">
            {jobs === null ? (
              <p>{t('career.loading')}</p>
            ) : (
              <>
                <p className="mb-3 font-semibold">{t('filter.count', { count: visibleJobs.length })}</p>
                {visibleJobs.length === 0 ? (
                  <p className={ui.notice}>{t('filter.none')}</p>
                ) : (
                  <ul aria-label={t('job.listLabel')} className="space-y-4">
                    {visibleJobs.map((job) => (
                      <li key={job.id}>
                        <JobCard job={job} lang={lang} applied={appliedIds.includes(job.id)} onApply={openApply} announce={announce} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ApplyDialog
        lang={lang}
        job={applyingTo}
        profile={profile}
        services={services}
        announce={announce}
        updateProfile={updateProfile}
        onClose={closeApply}
        onSubmitted={(application) => {
          setAppliedIds((ids) => [...ids, application.jobId]);
          dispatch(DB_EVENTS.jobApplied, { jobId: application.jobId, applicationId: application.id }); // no support data
          setApplyingTo(null);
        }}
      />
    </section>
  );
};
