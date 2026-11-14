import React from 'react';
import { Lock } from 'lucide-react';
import type { SupportNeed, SupportPreferences } from '@db/shared-schemas';
import { supportLabel } from '../../i18n';
import { TextField } from '../../fields/TextField';
import { CheckboxField } from '../../fields/CheckboxField';
import { fieldId, type StepProps } from '../types';
import { ui } from '../ui';

/**
 * Order follows Technical Guide v2 §5: captions / sign language, screen reader support, large text, more time first,
 * then the remaining functional needs.
 */
export const SUPPORT_NEEDS: SupportNeed[] = [
  'sign_language_captions', 'screen_reader_materials', 'high_contrast_large_text', 'extra_time',
  'audio_instructions', 'written_not_phone', 'step_free_venue', 'quiet_workspace', 'other',
];

/**
 * Private support request. Functional needs only; no diagnosis, no medical proof (CLAUDE.md §4).
 * "Prefer not to say" is one tap, same size and place as every other choice (Guide v2 §5).
 */
export const SupportStep: React.FC<StepProps> = ({ lang, t, idBase, profile, update, announce }) => {
  const support: SupportPreferences = profile.support ?? { needs: [], tellLearningProvider: false };
  const setSupport = (next: SupportPreferences) => update({ support: next });

  const toggleNeed = (need: SupportNeed, checked: boolean) => {
    const needs = checked ? [...support.needs, need] : support.needs.filter((n) => n !== need);
    if (checked && support.preferNotToSay) announce(t('support.choiceCleared'));
    setSupport({
      ...support,
      needs,
      otherText: needs.includes('other') ? support.otherText : undefined,
      preferNotToSay: checked ? false : support.preferNotToSay,
    });
  };

  const togglePreferNotToSay = (checked: boolean) => {
    // Choosing it clears every specific need (nothing private is kept "just in case").
    setSupport(checked ? { needs: [], tellLearningProvider: false, preferNotToSay: true } : { ...support, preferNotToSay: false });
    if (checked) announce(t('support.preferNotToSay.chosen'));
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
        <CheckboxField
          id={fieldId(idBase, 'preferNotToSay')}
          label={t('support.preferNotToSay')}
          checked={!!support.preferNotToSay}
          onChange={togglePreferNotToSay}
        />
        <div className="border-t-2 border-stone-300 mt-1 pt-1">
          {SUPPORT_NEEDS.map((need) => (
            <CheckboxField
              key={need}
              id={fieldId(idBase, `need-${need}`)}
              label={supportLabel(lang, need)}
              checked={support.needs.includes(need)}
              onChange={(checked) => toggleNeed(need, checked)}
            />
          ))}
        </div>
      </fieldset>

      {support.needs.includes('other') && (
        <TextField
          id={fieldId(idBase, 'otherText')}
          lang={lang}
          label={t('field.otherText')}
          hint={t('field.otherText.hint')}
          value={support.otherText ?? ''}
          onChange={(otherText) => setSupport({ ...support, otherText })}
          multiline
          optional
          announce={announce}
        />
      )}

      {support.needs.length > 0 && (
        <CheckboxField
          id={fieldId(idBase, 'tellLearningProvider')}
          label={t('support.tellProvider')}
          checked={support.tellLearningProvider}
          onChange={(tellLearningProvider) => setSupport({ ...support, tellLearningProvider })}
        />
      )}
    </>
  );
};
