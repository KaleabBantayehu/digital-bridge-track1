import React, { useEffect, useId, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import {
  normaliseEtPhone, type ErrorCode, type JobApplication, type JobListing, type Lang, type OnboardingProfile, type SupportFilter,
} from '@db/shared-schemas';
import { errorText, supportLabel, t, type I18nKey } from '../i18n';
import { TextField } from '../fields/TextField';
import { CheckboxField } from '../fields/CheckboxField';
import { ErrorSummary } from '../wizard/ErrorSummary';
import type { Dev2Services } from '../wizard/services';
import { EMAIL_RE } from '../wizard/validation';
import { cleanId, ui } from '../wizard/ui';
import { jobTitle } from './jobText';
import { getVoiceNotes, hasVoiceNote } from '../voice/voiceNotes';

export interface ApplyDialogProps {
  lang: Lang;
  job: JobListing | null;
  profile: OnboardingProfile;
  services: Dev2Services;
  announce: (message: string) => void;
  /** Saves edited name/contact back to the profile so they are never asked twice (WCAG 3.3.7). */
  updateProfile: (partial: Partial<OnboardingProfile>) => void;
  onClose: () => void;
  onSubmitted: (application: JobApplication) => void;
}

const coverNoteKey = (jobId: string) => `coverNote:${jobId}`;

type Field = 'givenName' | 'familyName' | 'phone' | 'email' | 'coverNote';
const LABELS: Record<Field, I18nKey> = {
  givenName: 'field.givenName', familyName: 'field.familyName', phone: 'field.phone', email: 'field.email', coverNote: 'field.coverNote',
};

/** Application form in a native <dialog>, pre-filled from onboarding, voice-enabled answer, opt-in support sharing. */
export const ApplyDialog: React.FC<ApplyDialogProps> = ({ lang, job, profile, services, announce, updateProfile, onClose, onSubmitted }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const idBase = `apply-${cleanId(useId())}`;
  const titleId = `${idBase}-title`;
  const [values, setValues] = useState<Record<Field, string>>({ givenName: '', familyName: '', phone: '', email: '', coverNote: '' });
  const [inputMode, setInputMode] = useState<'typed' | 'voice'>('typed');
  const [share, setShare] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, ErrorCode>>>({});
  const [summaryKey, setSummaryKey] = useState(0);
  const [sending, setSending] = useState(false);

  const shareable: SupportFilter[] = profile.support?.needs ?? [];

  // Open/close the native dialog and pre-fill from the profile each time a job is chosen.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (job) {
      setValues({
        givenName: profile.name.givenName,
        familyName: profile.name.familyName,
        phone: profile.contact.phone ?? '',
        email: profile.contact.email ?? '',
        coverNote: '',
      });
      setInputMode('typed');
      setShare(false); // never pre-ticked
      setErrors({});
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  const set = (field: Field) => (value: string) => setValues((v) => ({ ...v, [field]: value }));
  const errorFor = (field: Field) => (errors[field] ? errorText(lang, errors[field]!) : undefined);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!job) return;
    const found: Partial<Record<Field, ErrorCode>> = {};
    if (!values.givenName.trim()) found.givenName = 'REQUIRED';
    if (!values.familyName.trim()) found.familyName = 'REQUIRED';
    if (!values.phone.trim()) found.phone = 'REQUIRED';
    else if (!normaliseEtPhone(values.phone)) found.phone = 'INVALID_ET_PHONE';
    if (values.email.trim() && !EMAIL_RE.test(values.email.trim())) found.email = 'INVALID_EMAIL';
    // A kept voice note counts as an answer (Guide v2 §5: works where speech-to-text does not).
    const noteKey = coverNoteKey(job.id);
    const voiceNote = hasVoiceNote(getVoiceNotes(), noteKey);
    if (!values.coverNote.trim() && !voiceNote) found.coverNote = 'REQUIRED';
    if (Object.keys(found).length) {
      setErrors(found);
      setSummaryKey((k) => k + 1);
      return;
    }
    setErrors({});
    setSending(true);
    try {
      updateProfile({
        name: { givenName: values.givenName.trim(), familyName: values.familyName.trim() },
        contact: { ...profile.contact, phone: normaliseEtPhone(values.phone) ?? values.phone, email: values.email.trim() || undefined },
      });
      const application = await services.submitApplication({
        jobId: job.id,
        applicantProfileId: profile.id,
        answers: [{
          questionId: 'cover_note',
          text: values.coverNote.trim(),
          inputMode: voiceNote ? 'voice' : inputMode,
          // Reference only; the audio itself stays on this device until a real upload endpoint exists.
          ...(voiceNote ? { audioRef: `voice-note:${noteKey}` } : {}),
        }],
        // Support needs are attached ONLY when the candidate ticked the box. Filters used are never included.
        ...(share && shareable.length
          ? { adjustmentRequest: { items: shareable, note: profile.support?.otherText, shareConsent: true as const } }
          : {}),
      });
      announce(t(lang, 'apply.sent', { title: jobTitle(job, lang).text }));
      onSubmitted(application);
    } finally {
      setSending(false);
    }
  };

  const title = job ? jobTitle(job, lang) : null;
  const summaryItems = (Object.keys(errors) as Field[]).map((field) => ({
    targetId: `${idBase}-${field}`,
    label: t(lang, LABELS[field]),
    message: errorText(lang, errors[field]!),
  }));

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onClose={onClose} className={ui.dialog} lang={lang}>
      {job && title && (
        <form noValidate onSubmit={submit} className="p-5" aria-labelledby={titleId}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 id={titleId} className="text-xl font-bold">
              {t(lang, 'apply.title', { title: title.text })}
            </h2>
            <button type="button" onClick={() => dialogRef.current?.close()} aria-label={t(lang, 'common.close')} className={ui.btnQuiet}>
              <X aria-hidden="true" focusable="false" className="h-5 w-5" />
            </button>
          </div>

          <ErrorSummary items={summaryItems} focusKey={summaryKey} t={(key, vars) => t(lang, key, vars)} />

          <p className="mb-4">{t(lang, 'apply.prefilled')}</p>
          <TextField id={`${idBase}-givenName`} lang={lang} label={t(lang, 'field.givenName')} value={values.givenName} onChange={set('givenName')}
            error={errorFor('givenName')} autoComplete="given-name" spellCheck={false} required announce={announce} />
          <TextField id={`${idBase}-familyName`} lang={lang} label={t(lang, 'field.familyName')} value={values.familyName} onChange={set('familyName')}
            error={errorFor('familyName')} autoComplete="family-name" spellCheck={false} required announce={announce} />
          <TextField id={`${idBase}-phone`} lang={lang} label={t(lang, 'field.phone')} hint={t(lang, 'field.phone.hint')} value={values.phone}
            onChange={set('phone')} error={errorFor('phone')} type="tel" inputMode="tel" autoComplete="tel" required announce={announce} />
          <TextField id={`${idBase}-email`} lang={lang} label={t(lang, 'field.email')} value={values.email} onChange={set('email')}
            error={errorFor('email')} type="email" inputMode="email" autoComplete="email" spellCheck={false} optional voice={false} />
          <TextField id={`${idBase}-coverNote`} lang={lang} label={t(lang, 'field.coverNote')} hint={t(lang, 'field.coverNote.hint')}
            value={values.coverNote} onChange={set('coverNote')} error={errorFor('coverNote')} multiline required announce={announce}
            onVoiceUsed={() => setInputMode('voice')} voiceNoteKey={coverNoteKey(job.id)} />

          <div className="rounded-md border-2 border-stone-300 bg-white p-3 mb-4">
            <CheckboxField id={`${idBase}-share`} label={t(lang, 'apply.share')} checked={share} onChange={setShare} />
            <p className="text-sm text-stone-700">
              {shareable.length
                ? t(lang, 'apply.shareHint', { items: shareable.map((s) => supportLabel(lang, s)).join(', ') })
                : t(lang, 'apply.shareNone')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={sending} className={ui.btnPrimary}>
              <Send aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {t(lang, 'apply.submit')}
            </button>
            <button type="button" onClick={() => dialogRef.current?.close()} className={ui.btnQuiet}>
              {t(lang, 'common.cancel')}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
};
