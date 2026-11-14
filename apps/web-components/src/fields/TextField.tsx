import React, { useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import type { Lang } from '@db/shared-schemas';
import { t } from '../i18n';
import { VoiceField } from '../voice/VoiceField';
import { cx, ui } from '../wizard/ui';

export interface TextFieldProps {
  id: string;
  lang: Lang;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  /** Plain-language error text (already localised). Sets aria-invalid and links via aria-describedby. */
  error?: string;
  required?: boolean;
  /** Shows "(optional)" after the label. */
  optional?: boolean;
  type?: 'text' | 'tel' | 'email';
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  multiline?: boolean;
  /** Voice input + Review & Edit is on by default for every text field. */
  voice?: boolean;
  announce?: (message: string) => void;
  spellCheck?: boolean;
  /** Called after the user accepts a voice answer (lets callers record inputMode: 'voice'). */
  onVoiceUsed?: () => void;
}

/** Labelled text input/textarea with hint, inline error, autocomplete, paste allowed, and voice input. */
export const TextField: React.FC<TextFieldProps> = ({
  id, lang, label, value, onChange, hint, error, required, optional, type = 'text', inputMode, autoComplete,
  multiline, voice = true, announce, spellCheck, onVoiceUsed,
}) => {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const shared = {
    id,
    value,
    required,
    'aria-required': required || undefined,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': describedBy,
    autoComplete,
    spellCheck,
    className: cx(ui.input, error && ui.inputInvalid),
  };

  return (
    <div className={ui.field}>
      <label htmlFor={id} className={ui.label}>
        {label}{' '}
        {required && <span className="font-normal">{t(lang, 'wizard.required')}</span>}
        {optional && <span className="font-normal">{t(lang, 'wizard.optional')}</span>}
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
      {multiline ? (
        <textarea
          {...shared}
          ref={(el) => {
            inputRef.current = el;
          }}
          rows={4}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          {...shared}
          ref={(el) => {
            inputRef.current = el;
          }}
          type={type}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {voice && (
        <VoiceField
          lang={lang}
          fieldLabel={label}
          targetRef={inputRef}
          announce={announce}
          onUse={(text) => {
            onChange(multiline && value ? `${value} ${text}` : text);
            onVoiceUsed?.();
          }}
        />
      )}
    </div>
  );
};
