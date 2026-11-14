import React, { useId } from 'react';
import type { Translate } from '../i18n';
import { cleanId, cx } from './ui';

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
    <div className="mb-5">
      <p id={labelId} className="text-sm font-semibold mb-2">
        <span className="sr-only">{t('wizard.progressLabel')}: </span>
        {text}
      </p>
      <progress
        aria-labelledby={labelId}
        value={currentStep + 1}
        max={totalSteps}
        className="block w-full h-2.5 accent-terracotta"
      >
        {text}
      </progress>
      {/* Visual step pills; the same information is exposed once, by the labelled <progress> above. */}
      <ol aria-hidden="true" className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => (
          <li
            key={i}
            className={cx(
              'flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2 text-xs font-bold',
              i < currentStep && 'bg-terracotta text-white',
              i === currentStep && 'bg-ink text-white ring-2 ring-offset-2 ring-offset-parchment ring-ink',
              i > currentStep && 'bg-sand-light text-stone-700 border border-sand',
            )}
          >
            {i + 1}
          </li>
        ))}
      </ol>
    </div>
  );
};
