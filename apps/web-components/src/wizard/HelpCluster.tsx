import React, { useId, useRef, useState } from 'react';
import { BookOpen, HelpCircle, Languages, ShieldCheck, X } from 'lucide-react';
import { I18N, type Lang } from '@db/shared-schemas';
import { otherLang, t } from '../i18n';
import { ReadAloudButton } from '../tts/ReadAloudButton';
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
}

/**
 * Consistent Help (WCAG 3.2.6): same controls, same DOM order, same position on every step.
 * Order: Read aloud · Language · Simple words · Need help · My data.
 */
export const HelpCluster: React.FC<HelpClusterProps> = ({
  lang, readText, promptKey, simple, onToggleSimple, onSwitchLang, onOpenPrivacy, announce, audioBaseUrl,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = cleanId(useId());
  const target = otherLang(lang);
  // The on-screen read-aloud panel renders here, after every help button (stable focus order, 3.2.6).
  const [panelSlot, setPanelSlot] = useState<HTMLDivElement | null>(null);

  const openHelp = () => dialogRef.current?.showModal();
  const closeHelp = () => dialogRef.current?.close();

  return (
    <div className="mb-6">
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

      <button type="button" ref={openerRef} onClick={openHelp} aria-haspopup="dialog" className={ui.btnPill}>
        <HelpCircle aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
        {t(lang, 'help.needHelp')}
      </button>

      <button type="button" onClick={onOpenPrivacy} aria-haspopup="dialog" className={ui.btnPill}>
        <ShieldCheck aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
        {t(lang, 'help.privacy')}
      </button>

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
