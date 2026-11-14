import React, { useId, useState } from 'react';
import { ArrowDownToLine, Keyboard, Replace } from 'lucide-react';
import { t } from '../i18n';
import { fidelOrders, toFidel } from '../i18n/fidel';
import { cleanId, cx, ui } from '../wizard/ui';

export interface FidelHelperProps {
  /** Visible label of the field the letters go into (for the confirmation message). */
  fieldLabel: string;
  /** Current text of that field; "Add to the end" appends to it. */
  value: string;
  onChange: (text: string) => void;
  announce?: (message: string) => void;
  /** Focus target after inserting (the field itself). */
  targetRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

/**
 * Toggleable "type Amharic with English letters" helper (Amharic UI only). Shows the Fidel result live, lets the
 * learner fix the last letter's vowel with one tap, then replace or extend the field. Nothing is changed until the
 * learner presses a button.
 */
export const FidelHelper: React.FC<FidelHelperProps> = ({ fieldLabel, value, onChange, announce, targetRef }) => {
  const [open, setOpen] = useState(false);
  const [latin, setLatin] = useState('');
  const [override, setOverride] = useState<string | null>(null);
  const uid = cleanId(useId());
  const panelId = `${uid}-panel`;
  const inputId = `${uid}-latin`;
  const hintId = `${uid}-hint`;
  const resultId = `${uid}-result`;

  const fidel = override ?? toFidel(latin);
  const last = Array.from(fidel).pop() ?? '';
  const orders = fidelOrders(last);

  const insert = (mode: 'replace' | 'append') => {
    if (!fidel.trim()) return;
    onChange(mode === 'append' && value.trim() ? `${value.trimEnd()} ${fidel}` : fidel);
    announce?.(t('am', 'fidel.inserted', { field: fieldLabel }));
    setLatin('');
    setOverride(null);
    targetRef?.current?.focus();
  };

  const changeLast = (char: string) => {
    const chars = Array.from(fidel);
    chars[chars.length - 1] = char;
    setOverride(chars.join(''));
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={ui.btnPill}
      >
        <Keyboard aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
        {t('am', 'fidel.toggle')}
      </button>
      <div id={panelId} hidden={!open} className="mt-2 rounded-xl border border-sand bg-white p-3 shadow-sm">
        <label htmlFor={inputId} className={ui.label}>
          {t('am', 'fidel.label')}
        </label>
        <p id={hintId} className={ui.hint}>
          {t('am', 'fidel.hint')}
        </p>
        <input
          id={inputId}
          type="text"
          lang="en"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={`${hintId} ${resultId}`}
          value={latin}
          onChange={(e) => {
            setLatin(e.target.value);
            setOverride(null);
          }}
          className={ui.input}
        />
        <p className="mt-3 text-sm font-semibold">{t('am', 'fidel.result')}</p>
        <output id={resultId} htmlFor={inputId} className="block min-h-[44px] text-[1.375rem] leading-relaxed text-ink">
          {fidel || <span className="text-base text-stone-700">{t('am', 'fidel.empty')}</span>}
        </output>

        {orders.length > 0 && (
          <div role="group" aria-label={t('am', 'fidel.vowels')} className="mt-2 flex flex-wrap gap-2">
            {orders.map((char) => (
              <button
                key={char}
                type="button"
                aria-label={t('am', 'fidel.vowelPill', { char })}
                aria-pressed={char === last}
                onClick={() => changeLast(char)}
                className={cx(ui.btnToggle(char === last), 'rounded-full text-xl min-w-[48px]')}
              >
                {char}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => insert('replace')} disabled={!fidel.trim()} className={ui.btnPrimary}>
            <Replace aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {t('am', 'fidel.replace')}
          </button>
          <button type="button" onClick={() => insert('append')} disabled={!fidel.trim() || !value.trim()} className={ui.btnSecondary}>
            <ArrowDownToLine aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {t('am', 'fidel.append')}
          </button>
        </div>
      </div>
    </div>
  );
};
