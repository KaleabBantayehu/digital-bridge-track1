import React, { useId, useState } from 'react';
import { MessageSquare, RotateCcw } from 'lucide-react';
import { normaliseEtPhone, ERROR_MESSAGES } from '@db/shared-schemas';
import { TextField } from '../../fields/TextField';
import { CheckboxField } from '../../fields/CheckboxField';
import { fieldId, type StepProps } from '../types';
import { cleanId, ui } from '../ui';

export const ContactStep: React.FC<StepProps> = ({ lang, t, idBase, profile, update, errorFor, announce, services }) => {
  const [smsResult, setSmsResult] = useState<{ code: string; devLink: string; phone: string } | null>(null);
  const [smsNote, setSmsNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [resumeCode, setResumeCode] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const smsHeadingId = cleanId(useId());
  const restoreHeadingId = cleanId(useId());

  const setContact = (partial: Partial<typeof profile.contact>) => update({ contact: { ...profile.contact, ...partial } });

  const sendSms = async () => {
    const phone = normaliseEtPhone(profile.contact.phone ?? '');
    if (!phone) {
      setSmsResult(null);
      setSmsNote(t('sms.needPhone'));
      announce(t('sms.needPhone'));
      return;
    }
    setBusy(true);
    setSmsNote(t('sms.sending'));
    try {
      const next = { ...profile, contact: { ...profile.contact, phone }, consent: { ...profile.consent, smsResume: true } };
      update({ contact: next.contact, consent: next.consent });
      const result = await services.requestResumeSms(next);
      setSmsResult({ code: result.code, devLink: result.devLink, phone });
      const message = t('sms.sent', { phone, code: result.code });
      setSmsNote(message);
      announce(message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setRestoreError('');
    if (!resumeCode.trim()) {
      setRestoreError(ERROR_MESSAGES.REQUIRED[lang]);
      return;
    }
    const result = await services.restoreFromCode(resumeCode);
    if (!result.ok) {
      const message = ERROR_MESSAGES[result.code][lang];
      setRestoreError(message);
      announce(message);
      return;
    }
    const { id: _id, partnerId: _partner, ...restored } = result.profile;
    update({ ...restored, lang });
    setResumeCode('');
    announce(t('sms.restored'));
  };

  return (
    <>
      <TextField
        id={fieldId(idBase, 'phone')}
        lang={lang}
        label={t('field.phone')}
        hint={t('field.phone.hint')}
        value={profile.contact.phone ?? ''}
        onChange={(v) => setContact({ phone: v })}
        error={errorFor('phone')}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required={!profile.contact.viaPartner}
        optional={!!profile.contact.viaPartner}
        announce={announce}
        voiceNote={false}
      />
      <CheckboxField
        id={fieldId(idBase, 'viaPartner')}
        label={t('field.viaPartner')}
        checked={!!profile.contact.viaPartner}
        onChange={(v) => setContact({ viaPartner: v })}
      />
      <div className="mt-4">
        <TextField
          id={fieldId(idBase, 'email')}
          voiceNote={false}
          lang={lang}
          label={t('field.email')}
          hint={t('field.email.hint')}
          value={profile.contact.email ?? ''}
          onChange={(v) => setContact({ email: v })}
          error={errorFor('email')}
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          optional
          announce={announce}
        />
      </div>

      <section aria-labelledby={smsHeadingId} className={`${ui.card} mb-4`}>
        <h3 id={smsHeadingId} className="flex items-center gap-2 text-lg font-bold mb-1">
          <MessageSquare aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0 text-terracotta" />
          {t('sms.heading')}
        </h3>
        <p className="mb-3">{t('sms.body')}</p>
        <button type="button" onClick={sendSms} disabled={busy} className={ui.btnSecondary}>
          {t('sms.send')}
        </button>
        {smsNote && <p className="mt-3 font-semibold">{smsNote}</p>}
        {smsResult && (
          <p className="mt-2 text-sm break-all">
            {t('sms.devLink')}{' '}
            <a href={smsResult.devLink} className="underline text-terracotta-dark inline-block min-h-[44px] py-2">
              {smsResult.devLink}
            </a>
          </p>
        )}
      </section>

      <section aria-labelledby={restoreHeadingId} className={ui.card}>
        <h3 id={restoreHeadingId} className="flex items-center gap-2 text-lg font-bold mb-2">
          <RotateCcw aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0 text-terracotta" />
          {t('sms.restoreHeading')}
        </h3>
        <TextField
          id={fieldId(idBase, 'resumeCode')}
          lang={lang}
          label={t('field.resumeCode')}
          hint={t('field.resumeCode.hint')}
          value={resumeCode}
          onChange={setResumeCode}
          error={restoreError || undefined}
          autoComplete="one-time-code"
          spellCheck={false}
          voice={false}
        />
        <button type="button" onClick={restore} className={ui.btnSecondary}>
          {t('sms.restore')}
        </button>
      </section>
    </>
  );
};
