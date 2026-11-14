import React, { useRef } from 'react';
import { AlertCircle, AudioLines } from 'lucide-react';
import type { Lang } from '@db/shared-schemas';
import { t } from '../i18n';
import { VoiceField } from '../voice/VoiceField';
import { getVoiceNoteSeconds, hasVoiceNote, useVoiceNotes } from '../voice/voiceNotes';
import { FidelHelper } from './FidelHelper';
import type { SpokenKind } from '../voice/spokenInput';
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
  /**
   * Key for the MediaRecorder voice-note fallback. Defaults to the field name (the part of `id` after the last "-"),
   * so every voice-enabled field offers a voice note. Fields that must be typed (phone, codes) set `voiceNote={false}`.
   */
  voiceNoteKey?: string;
  /** Offer "Record a voice note instead" (default true whenever `voice` is on). */
  voiceNote?: boolean;
  /** Amharic UI only: offer the Latin -> Fidel typing helper (default true for plain text fields). */
  fidelHelper?: boolean;
  /** How spoken answers are cleaned up: 'code' for ID/reference numbers. tel/email are inferred from `type`. */
  spokenKind?: SpokenKind;
}

/** Labelled text input/textarea with hint, inline error, autocomplete, paste allowed, and voice input. */
export const TextField: React.FC<TextFieldProps> = ({
  id, lang, label, value, onChange, hint, error, required, optional, type = 'text', inputMode, autoComplete,
  multiline, voice = true, announce, spellCheck, onVoiceUsed, voiceNoteKey, voiceNote = true, fidelHelper = true, spokenKind,
}) => {
  const kind: SpokenKind = type === 'tel' ? 'tel' : type === 'email' ? 'email' : (spokenKind ?? 'text');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const noteKey = voice && voiceNote ? (voiceNoteKey ?? id.slice(id.lastIndexOf('-') + 1)) : undefined;
  const notes = useVoiceNotes();
  const hasNote = !!noteKey && hasVoiceNote(notes, noteKey);
  const seconds = hasNote && noteKey ? getVoiceNoteSeconds(noteKey) : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const badgeId = hasNote ? `${id}-voicenote` : undefined;
  const describedBy = [hintId, errorId, badgeId].filter(Boolean).join(' ') || undefined;
  const showFidel = lang === 'am' && fidelHelper && type === 'text' && !inputMode && spokenKind !== 'code';

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
    <div className={ui.field} data-db-field="">
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
      {hasNote && (
        <p id={badgeId} className={`${ui.badge} mt-2`}>
          <AudioLines aria-hidden="true" focusable="false" className="h-4 w-4 shrink-0" />
          {seconds ? t(lang, 'note.savedBadge', { seconds }) : t(lang, 'note.savedBadgeShort')}
        </p>
      )}
      {showFidel && (
        <FidelHelper
          fieldLabel={label}
          value={value}
          onChange={onChange}
          announce={announce}
          targetRef={inputRef}
        />
      )}
      {voice && (
        <VoiceField
          lang={lang}
          fieldLabel={label}
          targetRef={inputRef}
          announce={announce}
          voiceNoteKey={noteKey}
          fidelHelper={showFidel && kind === 'text'}
          spokenKind={kind}
          onUse={(text) => {
            onChange(multiline && value ? `${value} ${text}` : text);
            onVoiceUsed?.();
          }}
        />
      )}
    </div>
  );
};
