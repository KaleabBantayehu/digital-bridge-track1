import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cx, ui } from '../wizard/ui';

export interface CheckboxFieldProps {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  error?: string;
  required?: boolean;
  requiredText?: string;
}

/** Native checkbox with a large clickable label (whole row is the target, >= 44px tall). */
export const CheckboxField: React.FC<CheckboxFieldProps> = ({ id, label, checked, onChange, hint, error, required, requiredText }) => {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="mb-2">
      {error && (
        <p id={errorId} className={ui.error}>
          <AlertCircle aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <div className={ui.checkRow}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          className={ui.checkbox}
        />
        <label htmlFor={id} className={cx('text-base cursor-pointer', error && 'font-semibold')}>
          {label}
          {required && requiredText && <span className="font-normal"> {requiredText}</span>}
          {hint && (
            <span id={hintId} className="block text-sm text-stone-700">
              {hint}
            </span>
          )}
        </label>
      </div>
    </div>
  );
};
