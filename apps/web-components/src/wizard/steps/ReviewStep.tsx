import React from 'react';
import { Pencil, ShieldCheck } from 'lucide-react';
import { supportLabel, type I18nKey } from '../../i18n';
import { formatDob } from '../../fields/EthiopianDateSelect';
import { PARTNER_ORGS } from './IdentityStep';
import type { StepProps } from '../types';
import { ui } from '../ui';
import { hasVoiceNote, useVoiceNotes } from '../../voice/voiceNotes';

interface Row {
  label: string;
  value: React.ReactNode;
}

/** Accessible summary (<h3> per section, <dl> rows) with an Edit button that jumps back to each step. */
export const ReviewStep: React.FC<StepProps> = ({ lang, t, profile, goToStep, openPrivacy, editMode }) => {
  const notGiven = <span className="italic">{t('review.notGiven')}</span>;
  const voiceNotes = useVoiceNotes();
  const nameValue = (field: 'givenName' | 'familyName') =>
    profile.name[field] || (hasVoiceNote(voiceNotes, field) ? t('review.voiceNote') : notGiven);
  const yesNo = (v: boolean) => t(v ? 'common.yes' : 'common.no');
  const id = profile.identity;
  const partner = PARTNER_ORGS.find((o) => o.id === id?.partnerVoucher?.partnerId);

  const sections: { step: number; titleKey: I18nKey; rows: Row[] }[] = [
    {
      step: 0, titleKey: 'review.consent', rows: [
        { label: t('consent.saveAnswers'), value: yesNo(profile.consent.saveAnswers) },
        { label: t('consent.smsResume'), value: yesNo(profile.consent.smsResume) },
        { label: t('consent.shareWithEmployers'), value: yesNo(profile.consent.shareWithEmployers) },
      ],
    },
    {
      step: 1, titleKey: 'review.name', rows: [
        { label: t('field.givenName'), value: nameValue('givenName') },
        { label: t('field.familyName'), value: nameValue('familyName') },
      ],
    },
    {
      step: 2, titleKey: 'review.contact', rows: [
        { label: t('field.phone'), value: profile.contact.phone || (profile.contact.viaPartner ? t('review.viaPartner') : notGiven) },
        { label: t('field.email'), value: profile.contact.email || notGiven },
      ],
    },
    {
      step: 3, titleKey: 'review.dob', rows: [
        { label: t('field.dob'), value: profile.dateOfBirth ? formatDob(profile.dateOfBirth, lang) : notGiven },
      ],
    },
    {
      step: 4, titleKey: 'review.identity', rows: [
        { label: t('field.route'), value: id ? t(`id.${id.route}`) : notGiven },
        ...(id?.referenceNumber ? [{ label: t('field.referenceNumber'), value: id.referenceNumber }] : []),
        ...(id?.documentKind ? [{ label: t('field.documentKind'), value: t(`doc.${id.documentKind}`) }] : []),
        ...(partner ? [{ label: t('field.partnerId'), value: <span lang="en">{partner.name}</span> }] : []),
      ],
    },
    {
      step: 5, titleKey: 'review.support', rows: [
        {
          label: t('support.legend'),
          value: profile.support?.needs.length ? (
            <ul className="list-disc ps-5">
              {profile.support.needs.map((n) => (
                <li key={n}>{n === 'other' && profile.support?.otherText ? profile.support.otherText : supportLabel(lang, n)}</li>
              ))}
            </ul>
          ) : (
            t(profile.support?.preferNotToSay ? 'review.preferNotToSay' : 'review.none')
          ),
        },
      ],
    },
  ];

  return (
    <>
      {sections.map(({ step, titleKey, rows }) => (
        <div key={step} className={`${ui.card} mb-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-lg font-bold">{t(titleKey)}</h3>
            <button type="button" onClick={() => goToStep(step)} className={ui.btnSecondary}>
              <Pencil aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {t('review.edit')}
              <span className="sr-only"> {t(titleKey)}</span>
            </button>
          </div>
          <dl className="space-y-2">
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="font-semibold">{row.label}</dt>
                <dd className="break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <button type="button" onClick={openPrivacy} className={`${ui.btnSecondary} mb-2`}>
        <ShieldCheck aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
        {t(editMode ? 'edit.privacy' : 'help.privacy')}
      </button>
    </>
  );
};
