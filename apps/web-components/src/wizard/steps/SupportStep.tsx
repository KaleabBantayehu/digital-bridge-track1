import React from 'react';
import { Lock } from 'lucide-react';
import type { SupportNeed, SupportPreferences } from '@db/shared-schemas';
import { supportLabel } from '../../i18n';
import { TextField } from '../../fields/TextField';
import { CheckboxField } from '../../fields/CheckboxField';
import { fieldId, type StepProps } from '../types';
import { ui } from '../ui';

export const SUPPORT_NEEDS: SupportNeed[] = [
  'screen_reader_materials', 'sign_language_captions', 'step_free_venue', 'extra_time',
  'high_contrast_large_text', 'audio_instructions', 'written_not_phone', 'quiet_workspace', 'other',
];

/** Private support request. Functional needs only; no diagnosis, no medical proof (CLAUDE.md §4). */
export const SupportStep: React.FC<StepProps> = ({ lang, t, idBase, profile, update, announce }) => {
  const support: SupportPreferences = profile.support ?? { needs: [], tellLearningProvider: false };
  const setSupport = (partial: Partial<SupportPreferences>) => update({ support: { ...support, ...partial } });

  const toggleNeed = (need: SupportNeed, checked: boolean) => {
    const needs = checked ? [...support.needs, need] : support.needs.filter((n) => n !== need);
    setSupport({ needs, otherText: needs.includes('other') ? support.otherText : undefined });
  };

  return (
    <>
      <p className={ui.notice}>
        <Lock aria-hidden="true" focusable="false" className="h-6 w-6 shrink-0 text-terracotta" />
        <strong>{t('support.noProof')}</strong>
      </p>

      <fieldset className={ui.fieldset}>
        <legend className={ui.legend}>
          {t('support.legend')} <span className="font-normal">{t('wizard.optional')}</span>
        </legend>
        {SUPPORT_NEEDS.map((need) => (
          <CheckboxField
            key={need}
            id={fieldId(idBase, `need-${need}`)}
            label={supportLabel(lang, need)}
            checked={support.needs.includes(need)}
            onChange={(checked) => toggleNeed(need, checked)}
          />
        ))}
      </fieldset>

      {support.needs.includes('other') && (
        <TextField
          id={fieldId(idBase, 'otherText')}
          lang={lang}
          label={t('field.otherText')}
          hint={t('field.otherText.hint')}
          value={support.otherText ?? ''}
          onChange={(otherText) => setSupport({ otherText })}
          multiline
          optional
          announce={announce}
        />
      )}

      <CheckboxField
        id={fieldId(idBase, 'tellLearningProvider')}
        label={t('support.tellProvider')}
        checked={support.tellLearningProvider}
        onChange={(tellLearningProvider) => setSupport({ tellLearningProvider })}
      />
    </>
  );
};
