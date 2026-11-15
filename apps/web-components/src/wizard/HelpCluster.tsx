import React, { useId, useRef, useState } from 'react';
import { BookOpen, HelpCircle, Languages, ShieldCheck, X } from 'lucide-react';
import { I18N, type Lang } from '@db/shared-schemas';
import { otherLang, t } from '../i18n';
import { ReadAloudButton } from '../tts/ReadAloudButton';
import { buildStepScript } from './stepScript';
import { setVisionMode, useVisionMode, VISION_LABEL_KEYS, VISION_MODES, type VisionMode } from './vision';
import type { I18nKey } from '../i18n';
import { cleanId, ui } from './ui';

export interface HelpClusterProps {
  lang: Lang;
  /** Text read by "Read aloud" (current step heading + instructions). */
  readText: string;
  promptKey: string;
  simple: boolean;
  onToggleSimple: () => void;
  onSwitchLang: (lang: Lang) => void;
  onOpenPrivacy: () => void;
  announce: (message: string) => void;
  audioBaseUrl?: string;
  /** Ethiopian Sign Language interpreter / captions request (stored as the private support need). */
  signLanguage?: boolean;
  onSignLanguage?: (wanted: boolean) => void;
}

const KEYS: Record<string, string> = { tab: 'Tab', shiftTab: 'Shift + Tab', space: 'Space', enter: 'Enter', altV: 'Alt + V' };

/** Render "{tab}"-style placeholders as <kbd lang="en"> so key names are never read with the Amharic voice. */
function withKeys(text: string): React.ReactNode[] {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1];
    return key && KEYS[key] ? (
      <kbd key={i} lang="en" className="rounded border border-stone-500 bg-white px-1.5 py-0.5 font-mono text-sm text-ink">
        {KEYS[key]}
      </kbd>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    );
  });
}
const plainKeys = (text: string) => text.replace(/\{(\w+)\}/g, (_, key: string) => KEYS[key] ?? key);

/**
 * Consistent Help (WCAG 3.2.6): same controls, same DOM order, same position on every step.
 * Order: Read aloud · Language · Simple words · Need help · My data.
 */
export const HelpCluster: React.FC<HelpClusterProps> = ({
  lang, readText, promptKey, simple, onToggleSimple, onSwitchLang, onOpenPrivacy, announce, audioBaseUrl, signLanguage = false, onSignLanguage,
}) => {
  const guide = ['help.guide.tab', 'help.guide.choose', 'help.guide.voice', 'help.guide.numbers'] as const;
  const guideText = guide.map((key) => plainKeys(t(lang, key))).join(' ');
  const signId = `${cleanId(useId())}-sign`;
  const visionId = `${cleanId(useId())}-vision`;
  const vision = useVisionMode();
  const visionLabel = (mode: VisionMode) => t(lang, VISION_LABEL_KEYS[mode] as I18nKey);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = cleanId(useId());
  const target = otherLang(lang);
  // The on-screen read-aloud panel renders here, after every help button (stable focus order, 3.2.6).
  const [panelSlot, setPanelSlot] = useState<HTMLDivElement | null>(null);

  const openHelp = () => dialogRef.current?.showModal();
  const closeHelp = () => dialogRef.current?.close();

  const clusterRef = useRef<HTMLDivElement>(null);
  // Read aloud says the whole step: question, hint, then each field and choice with its voice-control number.
  const stepPhrases = () => {
    const root = clusterRef.current?.closest('section');
    return root ? buildStepScript(root, lang, readText) : [];
  };

  return (
    <div className="mb-6" ref={clusterRef}>
    <div role="group" aria-label={t(lang, 'help.groupLabel')} className="flex flex-wrap gap-2 rounded-2xl border border-sand bg-white/70 p-2">
      <ReadAloudButton
        lang={lang}
        text={readText}
        promptKey={promptKey}
        announce={announce}
        audioBaseUrl={audioBaseUrl}
        pill
        panelSlot={panelSlot}
        actionId="read"
        getPhrases={stepPhrases}
      />

      <button type="button" onClick={() => onSwitchLang(target)} className={ui.btnPill} data-db-action="lang">
        <Languages aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
        <span className="sr-only">{t(lang, 'lang.switchTo')}: </span>
        <span lang={target}>{I18N[target]['lang.selfName']}</span>
      </button>

      <button type="button" onClick={onToggleSimple} aria-pressed={simple} className={ui.btnPillToggle(simple)}>
        <BookOpen aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
        {t(lang, 'help.simpleWords')}
      </button>

      <button type="button" ref={openerRef} onClick={openHelp} aria-haspopup="dialog" className={ui.btnPill} data-db-help-button="">
        <HelpCircle aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
        {t(lang, 'help.needHelp')}
      </button>

      <button type="button" onClick={onOpenPrivacy} aria-haspopup="dialog" className={ui.btnPill}>
        <ShieldCheck aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
        {t(lang, 'help.privacy')}
      </button>

      {/* Colour mode: same place on every step (3.2.6). Native select, visible label. */}
      <span className="inline-flex flex-wrap items-center gap-2 rounded-full border-2 border-stone-500 bg-white ps-3">
        <label htmlFor={visionId} className="text-sm font-semibold">
          {t(lang, 'vision.label')}
        </label>
        <select
          id={visionId}
          value={vision}
          onChange={(e) => {
            const mode = e.target.value as VisionMode;
            setVisionMode(mode);
            announce(t(lang, 'vision.changed', { mode: visionLabel(mode) }));
          }}
          className="min-h-[44px] max-w-full rounded-full border-0 bg-transparent pe-2 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-terracotta-dark"
        >
          {VISION_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {visionLabel(mode)}
            </option>
          ))}
        </select>
      </span>

      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        onClose={() => openerRef.current?.focus()}
        className={ui.dialog}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 id={dialogTitleId} className="text-xl font-bold">{t(lang, 'help.dialogTitle')}</h2>
            <button type="button" onClick={closeHelp} aria-label={t(lang, 'common.close')} className={ui.btnQuiet}>
              <X aria-hidden="true" focusable="false" className="h-5 w-5" />
            </button>
          </div>
          <ul className="list-disc ps-5 space-y-2 mb-4">
            <li>{t(lang, 'help.dialogBody1')}</li>
            <li>{t(lang, 'help.dialogBody2')}</li>
            <li>{t(lang, 'help.dialogBody3')}</li>
            <li>{t(lang, 'help.dialogBody4')}</li>
          </ul>

          <section aria-labelledby={`${dialogTitleId}-blind`} className="mb-4 rounded-xl border border-sand bg-white p-3">
            <h3 id={`${dialogTitleId}-blind`} className="text-lg font-bold mb-2">{t(lang, 'help.blindTitle')}</h3>
            <ul className="list-disc ps-5 space-y-1 mb-3">
              {guide.map((key) => (
                <li key={key}>{withKeys(t(lang, key))}</li>
              ))}
            </ul>
            <ReadAloudButton lang={lang} text={guideText} label={`${t(lang, 'help.readAloud')}: ${t(lang, 'help.blindTitle')}`} announce={announce} pill />
          </section>

          {onSignLanguage && (
            <section aria-labelledby={`${dialogTitleId}-sign`} className="mb-4 rounded-xl border border-sand bg-white p-3">
              <h3 id={`${dialogTitleId}-sign`} className="text-lg font-bold mb-2">{t(lang, 'help.signTitle')}</h3>
              <p className="mb-2">{t(lang, 'help.signBody')}</p>
              <div className={ui.checkRow}>
                <input
                  id={signId}
                  type="checkbox"
                  checked={signLanguage}
                  onChange={(e) => {
                    onSignLanguage(e.target.checked);
                    announce(t(lang, 'help.signSaved'));
                  }}
                  className={ui.checkbox}
                />
                <label htmlFor={signId} className="text-base cursor-pointer">{t(lang, 'help.signToggle')}</label>
              </div>
            </section>
          )}
          <button type="button" onClick={closeHelp} className={ui.btnPrimary}>
            {t(lang, 'common.close')}
          </button>
        </div>
      </dialog>
    </div>
    <div ref={setPanelSlot} />
    </div>
  );
};
