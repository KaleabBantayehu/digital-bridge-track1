import React, { useId, useState } from 'react';
import { Building2 } from 'lucide-react';
import type { ErrorCode, JobListing, Lang, SupportFilter } from '@db/shared-schemas';
import { errorText, makeT, supportLabel, type I18nKey } from '../i18n';
import { TextField } from '../fields/TextField';
import { CheckboxField } from '../fields/CheckboxField';
import { SelectField } from '../fields/SelectField';
import { ErrorSummary } from '../wizard/ErrorSummary';
import { LiveRegion, useAnnouncer } from '../wizard/LiveRegion';
import { localServices, type Dev2Services } from '../wizard/services';
import { EMAIL_RE } from '../wizard/validation';
import { cleanId, ui, cx } from '../wizard/ui';
import { ETHIOPIC_CSS, scriptClass } from '../i18n/script';
import { useVisionMode } from '../wizard/vision';
import { CAREER_FILTERS } from './jobText';
import { LOCATION_KEYS } from './seedJobs';

export interface EmployerFormProps {
  lang?: Lang;
  services?: Dev2Services;
  /** Parent live region; when absent (standalone <db-employer-accommodations>) the form renders its own. */
  announce?: (message: string) => void;
  onPosted?: (job: JobListing) => void;
  /** 2 when standalone, 3 when nested under the Career Gateway's <h2>. */
  headingLevel?: 2 | 3;
}

type Field = 'jobTitle' | 'employerName' | 'location' | 'description' | 'contactEmail';
const LABELS: Record<Field, I18nKey> = {
  jobTitle: 'field.jobTitle', employerName: 'field.employerName', location: 'field.location', description: 'field.description', contactEmail: 'field.contactEmail',
};
const EMPTY = { jobTitle: '', employerName: '', location: '', description: '', contactEmail: '' };

const LOW_COST_ADJUSTMENTS: Array<{
  filter: SupportFilter;
  title: I18nKey;
  explanation: I18nKey;
  cost: I18nKey;
}> = [
  { filter: 'screen_reader_software', title: 'employer.adjustment.screenReader.title', explanation: 'employer.adjustment.screenReader.explanation', cost: 'employer.adjustment.screenReader.cost' },
  { filter: 'flexible_hours', title: 'employer.adjustment.flexible.title', explanation: 'employer.adjustment.flexible.explanation', cost: 'employer.adjustment.flexible.cost' },
  { filter: 'written_not_phone', title: 'employer.adjustment.instructions.title', explanation: 'employer.adjustment.instructions.explanation', cost: 'employer.adjustment.instructions.cost' },
  { filter: 'sign_language_captions', title: 'employer.adjustment.captions.title', explanation: 'employer.adjustment.captions.explanation', cost: 'employer.adjustment.captions.cost' },
  { filter: 'quiet_workspace', title: 'employer.adjustment.quiet.title', explanation: 'employer.adjustment.quiet.explanation', cost: 'employer.adjustment.quiet.cost' },
];

/** Employer accommodation form: post a job and the workplace support it offers. */
export const EmployerForm: React.FC<EmployerFormProps> = ({ lang = 'en', services = localServices, announce, onPosted, headingLevel = 2 }) => {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const t = makeT(lang);
  const own = useAnnouncer();
  const say = announce ?? own.announce;
  const idBase = `emp-${cleanId(useId())}`;
  const headingId = `${idBase}-heading`;
  const [values, setValues] = useState<Record<Field, string>>(EMPTY);
  const [remote, setRemote] = useState(false);
  const [offers, setOffers] = useState<SupportFilter[]>([]);
  const [errors, setErrors] = useState<Partial<Record<Field, ErrorCode>>>({});
  const [summaryKey, setSummaryKey] = useState(0);
  const [posted, setPosted] = useState('');

  const set = (field: Field) => (value: string) => setValues((v) => ({ ...v, [field]: value }));
  const errorFor = (field: Field) => (errors[field] ? errorText(lang, errors[field]!) : undefined);
  const toggleOffer = (filter: SupportFilter, on: boolean) => setOffers((list) => (on ? [...list, filter] : list.filter((f) => f !== filter)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: Partial<Record<Field, ErrorCode>> = {};
    if (!values.jobTitle.trim()) found.jobTitle = 'REQUIRED';
    if (!values.employerName.trim()) found.employerName = 'REQUIRED';
    if (!values.location) found.location = 'REQUIRED';
    if (!values.description.trim()) found.description = 'REQUIRED';
    if (values.contactEmail.trim() && !EMAIL_RE.test(values.contactEmail.trim())) found.contactEmail = 'INVALID_EMAIL';
    if (Object.keys(found).length) {
      setErrors(found);
      setSummaryKey((k) => k + 1);
      return;
    }
    setErrors({});
    const job = await services.postJob({
      title: values.jobTitle.trim(),
      employer: values.employerName.trim(),
      location: values.location,
      remote: remote || offers.includes('remote'),
      description: values.description.trim(),
      offeredAccommodations: offers,
      contactEmail: values.contactEmail.trim() || undefined,
    });
    const message = t('employer.posted', { title: values.jobTitle.trim() });
    setPosted(message);
    say(message);
    setValues(EMPTY);
    setRemote(false);
    setOffers([]);
    onPosted?.(job);
  };

  const summaryItems = (Object.keys(errors) as Field[]).map((field) => ({
    targetId: `${idBase}-${field}`,
    label: t(LABELS[field]),
    message: errorText(lang, errors[field]!),
  }));

  const vision = useVisionMode();
  return (
    <section
      aria-labelledby={headingId}
      lang={lang}
      data-vision-mode={announce ? undefined : vision}
      className={cx(
        'font-sans text-ink break-words',
        scriptClass(lang),
        // Mounted on its own (<db-employer-accommodations>): same card as the other widgets.
        !announce && 'w-full max-w-[56rem] mx-auto p-4 sm:p-8 rounded-2xl bg-parchment border border-sand shadow-card leading-relaxed',
      )}
    >
      {!announce && <style>{ETHIOPIC_CSS}</style>}
      {!announce && <LiveRegion announcement={own.announcement} />}
      <Heading id={headingId} tabIndex={-1} className="flex items-center gap-2 text-2xl font-bold mb-2">
        <Building2 aria-hidden="true" focusable="false" className="h-7 w-7 shrink-0 text-terracotta" />
        {t('employer.title')}
      </Heading>
      <p className="mb-4">{t('employer.intro')}</p>

      <form noValidate onSubmit={submit} aria-labelledby={headingId}>
        <ErrorSummary items={summaryItems} focusKey={summaryKey} t={t} />
        <TextField id={`${idBase}-jobTitle`} lang={lang} label={t('field.jobTitle')} hint={t('field.jobTitle.hint')} value={values.jobTitle}
          onChange={set('jobTitle')} error={errorFor('jobTitle')} required announce={say} voiceNote={false} />
        <TextField id={`${idBase}-employerName`} lang={lang} label={t('field.employerName')} value={values.employerName}
          onChange={set('employerName')} error={errorFor('employerName')} autoComplete="organization" required announce={say} voiceNote={false} />
        <SelectField id={`${idBase}-location`} label={t('field.location')} value={values.location} onChange={set('location')}
          options={LOCATION_KEYS.map((key) => ({ value: key, label: t(`loc.${key}` as I18nKey) }))}
          placeholder={t('wizard.choose')} error={errorFor('location')} required requiredText={t('wizard.required')} />
        <CheckboxField id={`${idBase}-remote`} label={t('field.remoteJob')} checked={remote} onChange={setRemote} />
        <div className="mt-4">
          <TextField id={`${idBase}-description`} lang={lang} label={t('field.description')} hint={t('field.description.hint')}
            value={values.description} onChange={set('description')} error={errorFor('description')} multiline required announce={say} voiceNote={false} />
        </div>
        <TextField id={`${idBase}-contactEmail`} lang={lang} label={t('field.contactEmail')} value={values.contactEmail}
          onChange={set('contactEmail')} error={errorFor('contactEmail')} type="email" inputMode="email" autoComplete="email"
          spellCheck={false} optional voiceNote={false} />

        <fieldset className={ui.fieldset}>
          <legend className={ui.legend}>{t('employer.offersLegend')}</legend>
          {CAREER_FILTERS.map((filter) => (
            <CheckboxField key={filter} id={`${idBase}-offer-${filter}`} label={supportLabel(lang, filter)}
              checked={offers.includes(filter)} onChange={(on) => toggleOffer(filter, on)} />
          ))}
        </fieldset>

        <section aria-labelledby={`${idBase}-suggestions-heading`} className="mt-6">
          <h3 id={`${idBase}-suggestions-heading`} className="text-xl font-bold">
            {t('employer.suggestionsTitle')}
          </h3>
          <p className="mt-1 mb-3">{t('employer.suggestionsIntro')}</p>
          <ul className="grid gap-3">
            {LOW_COST_ADJUSTMENTS.map((adjustment) => {
              const active = offers.includes(adjustment.filter);
              return (
                <li key={adjustment.filter} className="rounded-xl border-2 border-sand p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{t(adjustment.title)}</p>
                      <p className="mt-1">{t(adjustment.explanation)}</p>
                      <span className="mt-2 inline-block rounded-full border border-ink px-2 py-1 text-sm font-bold">
                        {t(adjustment.cost)}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-pressed={active}
                      className={cx(ui.btnSecondary, 'min-h-[44px] min-w-[44px] shrink-0')}
                      onClick={() => {
                        toggleOffer(adjustment.filter, !active);
                        say(`${t(active ? 'employer.removeSuggestion' : 'employer.addSuggestion')}: ${t(adjustment.title)}`);
                      }}
                    >
                      {t(active ? 'employer.removeSuggestion' : 'employer.addSuggestion')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <button type="submit" className={ui.btnPrimary}>{t('employer.submit')}</button>
        {posted && <p className="mt-3 font-semibold">{posted}</p>}
      </form>
    </section>
  );
};
