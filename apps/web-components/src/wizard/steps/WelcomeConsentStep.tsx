import React from 'react';
import { Clock, ListOrdered, Mic, Save, ShieldCheck } from 'lucide-react';
import { CheckboxField } from '../../fields/CheckboxField';
import { fieldId, type StepProps } from '../types';
import { ui } from '../ui';

export const WelcomeConsentStep: React.FC<StepProps> = ({ t, idBase, profile, update, errorFor, openPrivacy }) => {
  const setConsent = (key: keyof typeof profile.consent, value: boolean) =>
    update({ consent: { ...profile.consent, [key]: value, givenAt: new Date().toISOString() } });

  const points = [
    { Icon: ListOrdered, key: 'step0.point1' as const },
    { Icon: Clock, key: 'step0.point2' as const },
    { Icon: Save, key: 'step0.point3' as const },
    { Icon: Mic, key: 'step0.point4' as const },
  ];

  return (
    <>
      <ul className="mb-6 space-y-3">
        {points.map(({ Icon, key }) => (
          <li key={key} className="flex items-start gap-3">
            <Icon aria-hidden="true" focusable="false" className="h-6 w-6 shrink-0 text-terracotta" />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>

      <fieldset className={ui.fieldset}>
        <legend className={ui.legend}>{t('consent.legend')}</legend>
        <CheckboxField
          id={fieldId(idBase, 'saveAnswers')}
          label={t('consent.saveAnswers')}
          hint={t('consent.saveAnswers.hint')}
          checked={profile.consent.saveAnswers}
          onChange={(v) => setConsent('saveAnswers', v)}
          error={errorFor('saveAnswers')}
          required
          requiredText={t('wizard.required')}
        />
        <CheckboxField
          id={fieldId(idBase, 'smsResume')}
          label={t('consent.smsResume')}
          checked={profile.consent.smsResume}
          onChange={(v) => setConsent('smsResume', v)}
        />
        <CheckboxField
          id={fieldId(idBase, 'shareWithEmployers')}
          label={t('consent.shareWithEmployers')}
          checked={profile.consent.shareWithEmployers}
          onChange={(v) => setConsent('shareWithEmployers', v)}
        />
      </fieldset>

      <button type="button" onClick={openPrivacy} className={ui.btnSecondary}>
        <ShieldCheck aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
        {t('consent.privacyButton')}
      </button>
    </>
  );
};
