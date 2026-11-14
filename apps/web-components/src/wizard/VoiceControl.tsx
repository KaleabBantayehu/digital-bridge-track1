import React, { useEffect, useId, useRef, useState } from 'react';
import { AudioLines, Ear, EarOff } from 'lucide-react';
import type { Lang } from '@db/shared-schemas';
import { t as translate, type I18nKey } from '../i18n';
import { matchCommand, type VoiceCommand } from '../voice/commands';
import {
  getSpeechRecognition, isFieldListening, onFieldListening, playChime, speakText, speechLocale, stopSpeaking,
  type SpeechRecognitionLike,
} from '../voice/speech';
import { cleanId, ui } from './ui';

export interface VoiceControlProps {
  lang: Lang;
  /** The widget root; commands only ever act inside it. */
  rootRef: React.RefObject<HTMLElement | null>;
  announce: (message: string) => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
/** Give up after this many recognition failures in a row without a single result (stops a restart loop). */
const MAX_SILENT_FAILURES = 6;

/** Only one widget on the page answers the Alt+V shortcut: the first one mounted. */
let shortcutOwner: symbol | null = null;

const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

/**
 * Hands-free voice control for learners who cannot see the screen, or cannot type or use a pointer.
 * The learner turns it on once (button, or Alt+V); after that, spoken commands move through the form:
 * next / back / repeat / down / up / choose / answer / help / stop, in Amharic or English. Every command gets a soft
 * audible cue, a visible confirmation and a live-region announcement, and the focused item's name is spoken back
 * (with the device voice when it has one for the language). Nothing is ever submitted except by "next"/"choose".
 */
export const VoiceControl: React.FC<VoiceControlProps> = ({ lang, rootRef, announce }) => {
  const [on, setOn] = useState(false);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState('');
  const uid = cleanId(useId());
  const hintId = `${uid}-hint`;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onRef = useRef(false);
  const holdRef = useRef(false); // true while our own feedback or Read aloud is playing
  const engineRef = useRef(speechLocale(lang));
  const failuresRef = useRef(0);
  const restartRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const langRef = useRef(lang);
  langRef.current = lang;
  const t = (key: string, vars?: Record<string, string | number>) => translate(langRef.current, key as I18nKey, vars);

  // ---- Recognition loop --------------------------------------------------------------------------------------
  const halt = () => {
    clearTimeout(restartRef.current);
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.abort();
    }
  };

  const listen = () => {
    if (!onRef.current || holdRef.current || isFieldListening() || recRef.current) return;
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = engineRef.current;
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = clean(last?.[0]?.transcript);
      if (!text) return;
      failuresRef.current = 0;
      handle(text);
    };
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        turnOff(t('vc.denied'));
        return;
      }
      // Amharic recognition missing or unreachable on this device: keep going in English, and say so.
      if ((event.error === 'language-not-supported' || event.error === 'network') && engineRef.current !== 'en-US') {
        engineRef.current = 'en-US';
        feedback(t('vc.englishFallback'));
        return;
      }
      if (event.error !== 'no-speech' && event.error !== 'aborted') failuresRef.current += 1;
    };
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      if (!onRef.current) return;
      if (failuresRef.current >= MAX_SILENT_FAILURES) {
        turnOff(t('vc.unsupported'));
        return;
      }
      restartRef.current = setTimeout(listen, 300); // continuous recognition stops after silence; keep listening
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      recRef.current = null;
      failuresRef.current += 1;
    }
  };

  /** Show, announce and (when the device has a voice for the language) speak a message; listening pauses meanwhile. */
  const feedback = (message: string) => {
    setStatus(message);
    announce(message);
    halt();
    holdRef.current = true;
    const spoken = speakText(langRef.current, message, () => {
      holdRef.current = false;
      listen();
    });
    if (!spoken) {
      holdRef.current = false;
      listen();
    }
  };

  const turnOff = (message: string) => {
    onRef.current = false;
    holdRef.current = false;
    halt();
    stopSpeaking();
    setOn(false);
    setPaused(false);
    setStatus('');
    announce(message);
    playChime('next');
  };

  // ---- What a command does ----------------------------------------------------------------------------------
  const activeInRoot = (): HTMLElement | null => {
    const root = rootRef.current;
    const active = (root?.getRootNode() as Document | ShadowRoot | undefined)?.activeElement as HTMLElement | null;
    return root && active && root.contains(active) ? active : null;
  };

  const focusables = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.getClientRects().length > 0 && !el.closest('dialog:not([open]), [hidden]'),
    );

  const describe = (el: HTMLElement): string => {
    const input = el as HTMLInputElement;
    const name = clean(el.getAttribute('aria-label')) || clean(input.labels?.[0]?.textContent) || clean(el.textContent);
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      return `${name}, ${t(el.checked ? 'vc.checked' : 'vc.unchecked')}`;
    }
    if (el instanceof HTMLSelectElement) return `${name}, ${t('vc.list')}: ${clean(el.selectedOptions[0]?.textContent)}`;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return [name, t('vc.textbox'), clean(el.value)].filter(Boolean).join(', ');
    }
    return `${name}, ${t(el instanceof HTMLAnchorElement ? 'vc.link' : 'vc.button')}`;
  };

  /** After next/back: read the error summary if validation failed, otherwise the new question heading. */
  const afterNavigate = () => {
    setTimeout(() => {
      const root = rootRef.current;
      const errors = root?.querySelector('[role="alert"]');
      const heading = root?.querySelector('h2[tabindex="-1"]');
      feedback(clean(errors?.textContent) || clean(heading?.textContent));
    }, 350);
  };

  /** Wait until Read aloud has finished before listening again, so the question text is never taken as a command. */
  const holdWhileReading = (button: HTMLElement) => {
    halt();
    holdRef.current = true;
    const check = () => {
      if (!onRef.current) return;
      if (button.getAttribute('aria-pressed') === 'true') {
        restartRef.current = setTimeout(check, 500);
      } else {
        holdRef.current = false;
        listen();
      }
    };
    restartRef.current = setTimeout(check, 600);
  };

  const run = (command: VoiceCommand, heard: string) => {
    const root = rootRef.current;
    if (!root) return;
    const active = activeInRoot();
    switch (command) {
      case 'stop':
        turnOff(t('vc.off'));
        return;
      case 'help':
        feedback([t('vc.cmd.next'), t('vc.cmd.back'), t('vc.cmd.repeat'), t('vc.cmd.move'), t('vc.cmd.choose'), t('vc.cmd.answer'), t('vc.cmd.stop')].join('. '));
        return;
      case 'next': {
        // The visible Continue/Submit button (never one inside a closed dialog).
        const submit = Array.from(root.querySelectorAll<HTMLButtonElement>('form button[type="submit"]')).find(
          (button) => button.getClientRects().length > 0,
        );
        if (!submit) return feedback(t('vc.noNext'));
        submit.click();
        afterNavigate();
        return;
      }
      case 'back': {
        const back = root.querySelector<HTMLButtonElement>('[data-db-action="back"]');
        if (!back) return feedback(t('vc.noBack'));
        back.click();
        afterNavigate();
        return;
      }
      case 'repeat': {
        const read = root.querySelector<HTMLButtonElement>('[data-db-action="read"]');
        if (!read) return feedback(clean(root.querySelector('h2[tabindex="-1"]')?.textContent));
        if (read.getAttribute('aria-pressed') === 'true') read.click(); // stop, then start again from the top
        read.click();
        holdWhileReading(read);
        return;
      }
      case 'down':
      case 'up': {
        const step = command === 'down' ? 1 : -1;
        if (active instanceof HTMLSelectElement) {
          const index = Math.min(Math.max(active.selectedIndex + step, 0), active.options.length - 1);
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
          setter?.call(active, active.options[index].value);
          active.dispatchEvent(new Event('change', { bubbles: true }));
          return feedback(describe(active));
        }
        const list = focusables(root);
        if (!list.length) return;
        const at = active ? list.indexOf(active) : -1;
        const next = at < 0 ? list[step > 0 ? 0 : list.length - 1] : list[Math.min(Math.max(at + step, 0), list.length - 1)];
        next.focus();
        return feedback(describe(next));
      }
      case 'choose': {
        if (!active) return feedback(t('vc.start'));
        if (active instanceof HTMLSelectElement) return run('down', heard);
        if ((active instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(active.type)) || active instanceof HTMLTextAreaElement) {
          return run('answer', heard);
        }
        active.click();
        if (active.matches('button[type="submit"], [data-db-action="back"]')) return afterNavigate();
        setTimeout(() => {
          const now = activeInRoot();
          feedback(describe(now ?? active));
        }, 250);
        return;
      }
      case 'answer': {
        const mic = active?.closest('[data-db-field]')?.querySelector<HTMLButtonElement>('[data-db-action="voice-answer"]');
        if (!mic) return feedback(t('vc.noField'));
        mic.click(); // the field takes the microphone; voice control pauses until it is done
        return;
      }
      case 'english':
      case 'amharic': {
        const target: Lang = command === 'english' ? 'en' : 'am';
        if (target !== langRef.current) root.querySelector<HTMLButtonElement>('[data-db-action="lang"]')?.click();
        return;
      }
    }
  };

  const handle = (text: string) => {
    const command = matchCommand(text);
    if (!command) {
      feedback(t('vc.unknown', { text }));
      return;
    }
    playChime('next');
    setStatus(t('vc.heard', { text }));
    run(command, text);
  };

  // ---- On / off -----------------------------------------------------------------------------------------------
  const toggle = () => {
    if (onRef.current) {
      turnOff(t('vc.off'));
      return;
    }
    if (!getSpeechRecognition()) {
      setStatus(t('vc.unsupported'));
      announce(t('vc.unsupported'));
      return;
    }
    onRef.current = true;
    failuresRef.current = 0;
    engineRef.current = speechLocale(langRef.current);
    setOn(true);
    playChime('start');
    feedback(t('vc.on'));
  };
  const toggleRefFn = useRef(toggle);
  toggleRefFn.current = toggle;

  // Pause while a field dictates or records; resume afterwards.
  useEffect(
    () =>
      onFieldListening((busy) => {
        setPaused(busy);
        if (busy) halt();
        else if (onRef.current) restartRef.current = setTimeout(listen, 400);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // UI language changed: listen in that language again (falls back to English if unsupported).
  useEffect(() => {
    engineRef.current = speechLocale(lang);
    if (onRef.current) {
      halt();
      listen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Alt+V turns voice control on or off from anywhere on the page (a modifier shortcut, so it cannot fire by accident).
  useEffect(() => {
    const me = Symbol('voice-control');
    shortcutOwner ??= me;
    const onKey = (event: KeyboardEvent) => {
      if (shortcutOwner !== me || !event.altKey || event.ctrlKey || event.metaKey || event.code !== 'KeyV') return;
      event.preventDefault();
      toggleRef.current?.focus();
      toggleRefFn.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (shortcutOwner === me) shortcutOwner = null;
      onRef.current = false;
      halt();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Icon = on ? EarOff : Ear;
  const commands = ['vc.cmd.next', 'vc.cmd.back', 'vc.cmd.repeat', 'vc.cmd.move', 'vc.cmd.choose', 'vc.cmd.answer', 'vc.cmd.stop'];

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          ref={toggleRef}
          type="button"
          aria-pressed={on}
          aria-describedby={hintId}
          onClick={toggle}
          data-db-action="voice-control"
          className={ui.btnPillToggle(on)}
        >
          <Icon aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
          {t('vc.toggle')}
        </button>
        <p id={hintId} className="text-sm text-stone-700">
          {t('vc.hint')}{' '}
          <kbd lang="en" className="rounded border border-stone-500 bg-white px-1.5 py-0.5 font-mono text-xs text-ink">
            Alt + V
          </kbd>
        </p>
      </div>
      {!on && status && <p className="mt-2 text-sm text-stone-800">{status}</p>}
      {on && (
        <div className="mt-2 rounded-2xl border-2 border-lagoon bg-lagoon-light p-3 text-lagoon">
          <p className="flex items-center gap-2 font-semibold">
            <AudioLines aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {paused ? t('vc.paused') : t('vc.listening')}
          </p>
          {status && <p className="mt-1" data-db-voice-status="">{status}</p>}
          <p className="mt-2 text-sm font-semibold">{t('vc.commandsTitle')}</p>
          <ul className="list-disc ps-5 text-sm">
            {commands.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
