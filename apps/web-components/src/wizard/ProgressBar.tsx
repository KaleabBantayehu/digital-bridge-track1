import React, { useId } from 'react';
import type { Translate } from '../i18n';
import { cleanId } from './ui';

export interface ProgressBarProps {
  currentStep: number; // 0-based
  totalSteps: number;
  t: Translate;
}

/** Native <progress> with the same "Step X of Y" text visible and exposed to assistive tech. */
export const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps, t }) => {
  const labelId = cleanId(useId());
  const text = t('wizard.stepOf', { current: currentStep + 1, total: totalSteps });
  return (
    <div className="mb-4">
      <p id={labelId} className="text-sm font-semibold mb-1">
        <span className="sr-only">{t('wizard.progressLabel')}: </span>
        {text}
      </p>
      <progress
        aria-labelledby={labelId}
        value={currentStep + 1}
        max={totalSteps}
        className="w-full h-3 accent-terracotta"
      >
        {text}
      </progress>
    </div>
  );
};
