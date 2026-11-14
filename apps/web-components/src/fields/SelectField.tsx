import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cx, ui } from '../wizard/ui';

export interface SelectOption {
  value: string;
  label: string;
  /** Set when the option text is in another language than the UI (e.g. a Latin-script org name). */
  lang?: string;
}

export interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  hint?: string;
  error?: string;
  required?: boolean;
  requiredText?: string;
  autoComplete?: string;
  className?: string;
}

/** Native <select> with a visible label, hint and inline error. */
export const SelectField: React.FC<SelectFieldProps> = ({
  id, label, value, onChange, options, placeholder, hint, error, required, requiredText, autoComplete, className,
}) => {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cx(ui.field, className)}>
      <label htmlFor={id} className={ui.label}>
        {label}
        {required && requiredText && <span className="font-normal"> {requiredText}</span>}
      </label>
      {hint && (
        <p id={hintId} className={ui.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={ui.error}>
          <AlertCircle aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={cx(ui.input, error && ui.inputInvalid)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} lang={o.lang}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
};
