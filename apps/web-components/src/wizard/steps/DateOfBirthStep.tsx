import React from 'react';
import { EthiopianDateSelect } from '../../fields/EthiopianDateSelect';
import { fieldId, type StepProps } from '../types';

export const DateOfBirthStep: React.FC<StepProps> = ({ lang, idBase, profile, update, errorFor }) => (
  <EthiopianDateSelect
    id={fieldId(idBase, 'dob')}
    lang={lang}
    value={profile.dateOfBirth}
    onChange={(dateOfBirth) => update({ dateOfBirth })}
    error={errorFor('dob')}
  />
);
