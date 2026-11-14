import React from 'react';
import { TextField } from '../../fields/TextField';
import { fieldId, type StepProps } from '../types';

export const NameStep: React.FC<StepProps> = ({ lang, t, idBase, profile, update, errorFor, announce }) => {
  const setName = (key: 'givenName' | 'familyName', value: string) => update({ name: { ...profile.name, [key]: value } });
  return (
    <>
      <TextField
        id={fieldId(idBase, 'givenName')}
        lang={lang}
        label={t('field.givenName')}
        hint={t('field.givenName.hint')}
        value={profile.name.givenName}
        onChange={(v) => setName('givenName', v)}
        error={errorFor('givenName')}
        autoComplete="given-name"
        spellCheck={false}
        required
        announce={announce}
      />
      <TextField
        id={fieldId(idBase, 'familyName')}
        lang={lang}
        label={t('field.familyName')}
        hint={t('field.familyName.hint')}
        value={profile.name.familyName}
        onChange={(v) => setName('familyName', v)}
        error={errorFor('familyName')}
        autoComplete="family-name"
        spellCheck={false}
        required
        announce={announce}
      />
    </>
  );
};
