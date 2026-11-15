import React, { useEffect, useId, useRef, useState } from 'react';
import { AudioLines, Ear, EarOff, Loader, Mic, PauseCircle, Volume2 } from 'lucide-react';
import { toAsciiDigits, type Lang } from '@db/shared-schemas';
import { t as translate, type I18nKey } from '../i18n';
import { matchCommand, matchNumber, type VoiceCommand } from '../voice/commands';
import { parseMonthName, parseNumberWords } from '../voice/spokenInput';
import {
  getSpeechRecognition, isFieldListening, onFieldListening, playChime, speakText, speechLocale, stopSpeaking,
  type SpeechRecognitionLike,
} from '../voice/speech';
import { buildStepScript, stepControls } from './stepScript';
import { cleanId, cx, ui } from './ui';

export type VoiceWidgetKind = 'onboarding' | 'career';

export interface VoiceControlProps {
  lang: Lang;
  /** The widget root; commands only ever act inside it (plus the host's top bar links, numbered 91 and up). */
  rootRef: React.RefObject<HTMLElement | null>;
  announce: (message: string) => void;
  /** Which widget this is, for "jobs" / "sign up" switching and the hand-over when onboarding is finished. */
  kind?: VoiceWidgetKind;
}

type ListenState = 'listening' | 'hearing' | 'processing' | 'speaking' | 'paused';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
/** Give up after this many recognition failures in a row without a single result (stops a restart loop). */
const MAX_SILENT_FAILURES = 6;
/** Host top-bar links get numbers from here up, so they never collide with the widget's own items. */
const HOST_NUMBER_START = 91;

/** Only one widget on the page answers the Alt+V shortcut: the first one mounted. */
let shortcutOwner: symbol | null = null;

/**
 * Round-2 finding: two widgets on one page both numbered their items 1, 2, 3, so "3" pressed the wrong one.
 * Voice control now has a single owner per document; turning it on in one widget turns it off in the others.
 */
interface Controller {
  kind: VoiceWidgetKind;
  isOn: () => boolean;
  turnOn: (message?: string) => void;
  turnOff: (silent?: boolean) => void;
}
const controllers = new Map<symbol, Controller>();

const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

/**
 * Hands-free voice control for learners who cannot see the screen, or cannot type or use a pointer.
 * The learner turns it on once (button, or Alt+V); after that, spoken commands move through the form. Every command
 * gets a soft audible cue, a visible confirmation and a live-region announcement. Nothing is ever submitted except by
 * "next" / "choose" / an item number.
 */
export const VoiceControl: React.FC<VoiceControlProps> = ({ lang, rootRef, announce, kind = 'onboarding' }) => {
  const [on, setOn] = useState(false);
  const [paused, setPaused] = useState(false);
  const [state, setState] = useState<ListenState>('listening');
  const [status, setStatus] = useState('');
  const [activeItem, setActiveItem] = useState('');
  const uid = cleanId(useId());
  const hintId = `${uid}-hint`;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onRef = useRef(false);
  const holdRef = useRef(false); // true while our own feedback or Read aloud is playing
  const engineRef = useRef(speechLocale(lang));
  const failuresRef = useRef(0);
  const restartRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const numbersRef = useRef(new Map<number, HTMLElement>());
  const idRef = useRef(Symbol(`voice-control-${kind}`));
  const guideRef = useRef<{ queue: HTMLElement[]; current: HTMLElement | null; awaiting: 'answer' | 'confirm' | null }>({
    queue: [], current: null, awaiting: null,
  });
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
    // Mobile Chrome drops long continuous sessions; on touch devices listen one phrase at a time and restart.
    rec.continuous = !(typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
    rec.interimResults = false;
    // Noisy rooms: look at several guesses and act on the first one that is a real command or number.
    rec.maxAlternatives = 5;
    rec.onspeechstart = () => setState('hearing');
    rec.onspeechend = () => setState('processing');
    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const guesses: string[] = [];
      for (let i = 0; i < (last?.length ?? 0); i++) {
        const text = clean(last[i]?.transcript);
        if (text) guesses.push(text);
      }
      setState('listening');
      if (!guesses.length) return;
      failuresRef.current = 0;
      handle(guesses.find((g) => understood(g)) ?? guesses[0]);
    };
    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        turnOff(false, t('vc.denied'));
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
      setState((s) => (s === 'processing' || s === 'hearing' ? 'listening' : s));
      if (!onRef.current) return;
      if (failuresRef.current >= MAX_SILENT_FAILURES) {
        turnOff(false, t('vc.unsupported'));
        return;
      }
      restartRef.current = setTimeout(listen, 300); // recognition stops after silence; keep listening
    };
    recRef.current = rec;
    try {
      rec.start();
      setState('listening');
    } catch {
      recRef.current = null;
      failuresRef.current += 1;
    }
  };

  /** Show, announce and (when the device has a voice for the language) speak a message; listening pauses meanwhile. */
  const feedback = (message: string, after?: () => void) => {
    setStatus(message);
    announce(message);
    halt();
    holdRef.current = true;
    setState('speaking');
    const done = () => {
      holdRef.current = false;
      setState(isFieldListening() ? 'paused' : 'listening');
      if (after) after();
      else listen();
    };
    if (!speakText(langRef.current, message, done)) done();
  };

  const start = (message?: string) => {
    if (onRef.current) return;
    // Single owner: switch every other widget's voice control off first.
    controllers.forEach((c, id) => {
      if (id !== idRef.current && c.isOn()) c.turnOff(true);
    });
    onRef.current = true;
    failuresRef.current = 0;
    engineRef.current = speechLocale(langRef.current);
    setOn(true);
    playChime('start');
    feedback(message ?? t('vc.on'));
  };

  const turnOff = (silent = false, message?: string) => {
    onRef.current = false;
    holdRef.current = false;
    guideRef.current = { queue: [], current: null, awaiting: null };
    halt();
    stopSpeaking();
    setOn(false);
    setPaused(false);
    setStatus('');
    setActiveItem('');
    if (!silent) {
      announce(message ?? t('vc.off'));
      playChime('next');
    }
  };

  // ---- Helpers ----------------------------------------------------------------------------------------------
  const activeInRoot = (): HTMLElement | null => {
    const root = rootRef.current;
    const active = (root?.getRootNode() as Document | ShadowRoot | undefined)?.activeElement as HTMLElement | null;
    return root && active && root.contains(active) ? active : null;
  };

  const focusables = (scope: ParentNode) =>
    Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.getClientRects().length > 0 && !el.closest('dialog:not([open]), [hidden]'),
    );

  const describe = (el: HTMLElement): string => {
    const input = el as HTMLInputElement;
    const label = input.labels?.[0];
    let name = clean(el.getAttribute('aria-label'));
    if (!name && label) {
      const copy = label.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('[id]').forEach((hint) => hint.remove());
      name = clean(copy.textContent);
    }
    name ||= clean(el.textContent);
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      return `${name}, ${t(el.checked ? 'vc.checked' : 'vc.unchecked')}`;
    }
    if (el instanceof HTMLSelectElement) return `${name}, ${t('vc.list')}: ${clean(el.selectedOptions[0]?.textContent)}`;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return [name, t('vc.textbox'), clean(el.value)].filter(Boolean).join(', ');
    }
    return `${name}, ${t(el instanceof HTMLAnchorElement ? 'vc.link' : 'vc.button')}`;
  };

  const numberOf = (el: HTMLElement): number | undefined => {
    for (const [n, item] of numbersRef.current) if (item === el) return n;
    return undefined;
  };

  /** Round-2 finding: show and say which numbered item is active, with a distinct highlight on the page. */
  const markActive = (el: HTMLElement) => {
    const root = rootRef.current;
    root?.querySelectorAll('[data-vc-active]').forEach((node) => node.removeAttribute('data-vc-active'));
    document.querySelectorAll('[data-vc-active]').forEach((node) => node.removeAttribute('data-vc-active'));
    const holder = ((el as HTMLInputElement).labels?.[0] as HTMLElement | undefined) ?? el;
    holder.setAttribute('data-vc-active', 'true');
    const n = numberOf(el);
    const label = describe(el);
    setActiveItem(n ? t('vc.active', { n, label }) : label);
    return n ? t('vc.itemSelected', { n, label }) : label;
  };

  const stepBody = (root: HTMLElement) => root.querySelector<HTMLElement>('form, [data-db-step-body]') ?? root;

  /** The whole step, said once: question, hint, every field with its number (same script as Read aloud). */
  const stepSummary = () => {
    const root = rootRef.current;
    if (!root) return '';
    const heading = clean(root.querySelector('h2[tabindex="-1"]')?.textContent);
    const hint = clean(root.querySelector('[data-db-step-hint]')?.textContent);
    return buildStepScript(root, langRef.current, [heading, hint].filter(Boolean).join('. '))
      .map((p) => p.text)
      .join(' ');
  };

  /** After next/back: read the error summary if validation failed, otherwise the new step with its numbered items. */
  const afterNavigate = () => {
    guideRef.current = { queue: [], current: null, awaiting: null };
    setTimeout(() => {
      const root = rootRef.current;
      const errors = root?.querySelector('[role="alert"]');
      feedback(clean(errors?.textContent) || stepSummary());
    }, 450);
  };

  /** Wait while Read aloud is actually making sound, so the question is never taken as a command. */
  const holdWhileReading = (button: HTMLElement) => {
    halt();
    holdRef.current = true;
    setState('speaking');
    const check = () => {
      if (!onRef.current) return;
      if (button.getAttribute('aria-pressed') === 'true' && button.getAttribute('data-db-audible') === 'true') {
        restartRef.current = setTimeout(check, 500);
      } else {
        holdRef.current = false;
        setState('listening');
        listen();
      }
    };
    restartRef.current = setTimeout(check, 700);
  };

  /** A focused list (day, month, year…): a spoken value that is one of its options sets it ("15", "Meskerem"). */
  const setListBySpeech = (select: HTMLSelectElement, text: string): boolean => {
    const words = toAsciiDigits(text).toLowerCase().split(/\s+/).filter(Boolean);
    const candidates = new Set<string>();
    for (const w of words) if (/^\d+$/.test(w)) candidates.add(String(Number(w)));
    parseNumberWords(words).forEach((n) => candidates.add(String(n)));
    for (const w of words) {
      const eth = parseMonthName(w, 'ethiopian');
      const greg = parseMonthName(w, 'gregorian');
      if (eth) candidates.add(String(eth));
      if (greg) candidates.add(String(greg));
    }
    const option = [...select.options].find((o) => o.value && candidates.has(o.value));
    if (!option) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, option.value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    feedback(markActive(select));
    return true;
  };

  /** Would this guess do something? Used to pick the best of several alternatives in a noisy room. */
  const understood = (text: string) => {
    if (matchNumber(text) !== null || matchCommand(text) !== null) return true;
    const active = activeInRoot();
    return active instanceof HTMLSelectElement && /\d|[ሀ-፿]{2,}|[a-z]{4,}/i.test(text);
  };

  // ---- Guided fill (round-2 finding): one field at a time, read back, confirm ------------------------------------
  const guideNext = () => {
    const g = guideRef.current;
    const el = g.queue.shift();
    if (!el) {
      g.current = null;
      g.awaiting = null;
      feedback(t('guide.done'));
      return;
    }
    g.current = el;
    g.awaiting = 'answer';
    el.focus();
    const n = numberOf(el) ?? '';
    const label = describe(el).split(',')[0];
    feedback(t('guide.field', { n, label }), () => {
      const container = el.closest('[data-db-field], [data-db-dob]');
      const mic = container?.querySelector<HTMLButtonElement>('[data-db-action="voice-answer"], [data-db-action="dob-speak"]');
      if (mic) {
        playChime('start');
        mic.click(); // the field takes the microphone; voice control pauses until it is done
      } else {
        g.awaiting = null;
        listen();
      }
    });
  };

  const guideAfterField = () => {
    const g = guideRef.current;
    if (g.awaiting !== 'answer' || !g.current) return;
    const container = g.current.closest('[data-db-field], [data-db-dob]');
    const review = container?.querySelector<HTMLInputElement>('[data-db-review]');
    const noteKeep = container?.querySelector<HTMLButtonElement>('[data-db-action="note-keep"]');
    g.awaiting = 'confirm';
    if (review?.value) feedback(t('guide.confirm', { text: review.value }));
    else if (noteKeep) feedback(t('guide.noteReady'));
    else if (container?.matches('[data-db-dob]')) {
      g.awaiting = null;
      guideNext();
    } else feedback(t('guide.nothing'));
  };

  const guideAnswer = (command: VoiceCommand): boolean => {
    const g = guideRef.current;
    if (g.awaiting !== 'confirm' || !g.current) return false;
    const container = g.current.closest('[data-db-field]');
    const click = (action: string) => container?.querySelector<HTMLButtonElement>(`[data-db-action="${action}"]`)?.click();
    if (command === 'choose') {
      click('voice-use');
      click('note-keep');
      g.awaiting = null;
      guideNext();
      return true;
    }
    if (command === 'retry') {
      g.awaiting = 'answer';
      click('voice-cancel');
      const mic = container?.querySelector<HTMLButtonElement>('[data-db-action="voice-answer"]');
      playChime('start');
      mic?.click();
      return true;
    }
    if (command === 'skip') {
      click('voice-cancel');
      g.awaiting = null;
      guideNext();
      return true;
    }
    return false;
  };

  const switchTo = (target: VoiceWidgetKind) => {
    const widget = t(`vc.widget.${target}`);
    const other = [...controllers.entries()].find(([id, c]) => id !== idRef.current && c.kind === target);
    if (!other) {
      feedback(t('vc.noOther', { widget }));
      return;
    }
    turnOff(true);
    other[1].turnOn(t('vc.movedHere', { widget }));
  };

  // ---- What a command does ----------------------------------------------------------------------------------
  const run = (command: VoiceCommand, heard: string) => {
    const root = rootRef.current;
    if (!root) return;
    if (guideAnswer(command)) return;
    if (!['choose', 'retry', 'skip'].includes(command)) guideRef.current = { queue: [], current: null, awaiting: null };
    const active = activeInRoot();
    switch (command) {
      case 'stop':
        turnOff();
        return;
      case 'help': {
        // Co-designer finding: "help" must open the portal's Need help, not repeat the instructions.
        const helpButton = root.querySelector<HTMLButtonElement>('[data-db-help-button]');
        if (!helpButton) return run('commands', heard);
        helpButton.click();
        setTimeout(() => feedback(clean(root.querySelector('dialog[open] h2')?.textContent)), 250);
        return;
      }
      case 'commands':
        feedback(commandKeys.map((key) => t(key)).join('. '));
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
        const back = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-db-action="back"]')).find(
          (button) => button.getClientRects().length > 0,
        );
        if (!back) return feedback(t('vc.noBack'));
        back.click();
        afterNavigate();
        return;
      }
      case 'repeat': {
        const read = root.querySelector<HTMLButtonElement>('[data-db-action="read"]');
        if (!read) return feedback(stepSummary() || clean(root.querySelector('h2')?.textContent));
        if (read.getAttribute('aria-pressed') === 'true') read.click(); // stop, then start again from the top
        read.click();
        holdWhileReading(read);
        return;
      }
      case 'down':
      case 'up': {
        const step = command === 'down' ? 1 : -1;
        // Round-2 finding: from outside the step, "down" goes straight to the first field, not the help bar.
        const body = stepBody(root);
        const list = focusables(root);
        if (!list.length) return;
        let next: HTMLElement | undefined;
        if (!active || !body.contains(active)) {
          const inBody = focusables(body);
          next = step > 0 ? inBody[0] ?? list[0] : inBody[inBody.length - 1] ?? list[list.length - 1];
        } else {
          const at = list.indexOf(active);
          next = list[Math.min(Math.max(at + step, 0), list.length - 1)];
        }
        next.focus();
        return feedback(markActive(next));
      }
      case 'scrollDown':
      case 'scrollUp':
        window.scrollBy({ top: command === 'scrollDown' ? 360 : -360, behavior: 'instant' as ScrollBehavior });
        return feedback(t(command === 'scrollDown' ? 'vc.scrolledDown' : 'vc.scrolledUp'));
      case 'choose': {
        if (!active) return feedback(t('vc.start'));
        if (active instanceof HTMLSelectElement) {
          // "down"/"up" always move between items (so a list can never trap the learner); "choose" steps the list
          // to its next option and says it.
          const options = [...active.options].filter((option) => !option.disabled);
          const at = options.indexOf(active.selectedOptions[0]);
          const next = options[(at + 1) % options.length];
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
          setter?.call(active, next.value);
          active.dispatchEvent(new Event('change', { bubbles: true }));
          return feedback(markActive(active));
        }
        if ((active instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(active.type)) || active instanceof HTMLTextAreaElement) {
          return run('answer', heard);
        }
        active.click();
        if (active.matches('button[type="submit"], [data-db-action="back"]')) return afterNavigate();
        setTimeout(() => feedback(markActive(activeInRoot() ?? active)), 250);
        return;
      }
      case 'answer': {
        const container = active?.closest('[data-db-field], [data-db-dob]');
        const mic = container?.querySelector<HTMLButtonElement>('[data-db-action="voice-answer"], [data-db-action="dob-speak"]');
        if (!mic) return feedback(t('vc.noField'));
        playChime('start');
        mic.click(); // the field takes the microphone; voice control pauses until it is done
        return;
      }
      case 'guide': {
        const fields = stepControls(root).filter(
          (el) => (el instanceof HTMLInputElement && ['text', 'tel', 'email'].includes(el.type)) || el instanceof HTMLTextAreaElement,
        ).filter((el) => el.closest('[data-db-field]')?.querySelector('[data-db-action="voice-answer"]'));
        const dob = root.querySelector<HTMLElement>('[data-db-dob] select');
        if (!fields.length && !dob) return feedback(t('guide.choices'));
        guideRef.current = { queue: fields.length ? fields : [dob as HTMLElement], current: null, awaiting: null };
        feedback(t('guide.start'), guideNext);
        return;
      }
      case 'retry':
      case 'skip':
        return feedback(t('vc.unknown', { text: heard }));
      case 'career':
        return kind === 'career' ? feedback(t('vc.movedHere', { widget: t('vc.widget.career') })) : switchTo('career');
      case 'onboarding':
        return kind === 'onboarding' ? feedback(t('vc.movedHere', { widget: t('vc.widget.onboarding') })) : switchTo('onboarding');
      case 'english':
      case 'amharic': {
        const target: Lang = command === 'english' ? 'en' : 'am';
        if (target !== langRef.current) root.querySelector<HTMLButtonElement>('[data-db-action="lang"]')?.click();
        return;
      }
    }
  };

  /** "3" / "item three" / "ሶስት": go to the item wearing badge 3; press it if it is a button, link, checkbox or radio. */
  const choose = (n: number, heard: string) => {
    const el = numbersRef.current.get(n);
    if (!el || !el.isConnected) {
      feedback(t('vc.noNumber', { n }));
      return;
    }
    guideRef.current = { queue: [], current: null, awaiting: null };
    playChime('next');
    setStatus(t('vc.heard', { text: heard }));
    el.focus();
    const pressable = el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || el.tagName === 'SUMMARY' ||
      (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type));
    if (!pressable) {
      feedback(markActive(el));
      return;
    }
    el.click();
    if (el.matches('button[type="submit"], [data-db-action="back"]')) {
      afterNavigate();
      return;
    }
    setTimeout(() => feedback(markActive(el.isConnected ? el : activeInRoot() ?? el)), 250);
  };

  const handle = (text: string) => {
    const active = activeInRoot();
    const number = matchNumber(text);
    // On a focused list a bare value fills it ("15", "1995", "Meskerem"); "item 15" still jumps to item 15.
    if (active instanceof HTMLSelectElement && !/^(item|number|option|no|ቁጥር|ንጥል|ምርጫ)\b/i.test(text.trim()) && !matchCommand(text)) {
      if (setListBySpeech(active, text)) return;
    }
    if (number !== null) {
      choose(number, text);
      return;
    }
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
      turnOff();
      return;
    }
    if (window.isSecureContext === false) {
      // Phones opening the demo over http://192.168… have no microphone access at all.
      setStatus(t('vc.insecure'));
      announce(t('vc.insecure'));
      return;
    }
    if (!getSpeechRecognition()) {
      setStatus(t('vc.unsupported'));
      announce(t('vc.unsupported'));
      return;
    }
    start();
  };
  const fns = useRef({ toggle, start, turnOff, choose, guideAfterField });
  fns.current = { toggle, start, turnOff, choose, guideAfterField };

  // Register as a controller for the single-owner rule and widget switching.
  useEffect(() => {
    const id = idRef.current;
    controllers.set(id, {
      kind,
      isOn: () => onRef.current,
      turnOn: (message) => fns.current.start(message),
      turnOff: (silent) => fns.current.turnOff(silent),
    });
    return () => {
      controllers.delete(id);
    };
  }, [kind]);

  // Onboarding finished with voice control on: hand it to the Career Gateway when one is on the page.
  useEffect(() => {
    if (kind !== 'onboarding') return;
    const onDone = () => {
      if (!onRef.current) return;
      const career = [...controllers.values()].find((c) => c.kind === 'career');
      if (!career) return;
      setTimeout(() => {
        fns.current.turnOff(true);
        career.turnOn(translate(langRef.current, 'vc.movedCareer' as I18nKey));
      }, 600);
    };
    document.addEventListener('db-signup:done', onDone);
    return () => document.removeEventListener('db-signup:done', onDone);
  }, [kind]);

  // Numbered badges while voice control is on: every control on the current step (or in the open dialog), plus the
  // host's top-bar links from 91 up. The number sits on the label for inputs and is hidden from screen readers.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const clear = () => {
      root.querySelectorAll('[data-vc-num], [data-vc-active]').forEach((el) => {
        el.removeAttribute('data-vc-num');
        el.removeAttribute('data-vc-active');
      });
      document.querySelectorAll('.db-savanna-topbar [data-vc-num], [data-vc-active]').forEach((el) => {
        el.removeAttribute('data-vc-num');
        el.removeAttribute('data-vc-active');
      });
      numbersRef.current.clear();
    };
    if (!on) {
      clear();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const renumber = () => {
      root.querySelectorAll('[data-vc-num]').forEach((el) => el.removeAttribute('data-vc-num'));
      numbersRef.current.clear();
      const dialog = root.querySelector<HTMLElement>('dialog[open]');
      const list = focusables(dialog ?? root).filter((el) => el.dataset.dbAction !== 'voice-control');
      list.forEach((el, index) => {
        const n = index + 1;
        const field = el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
        const badgeOn = (field && (el as HTMLInputElement).labels?.[0]) || el;
        badgeOn.setAttribute('data-vc-num', String(n));
        numbersRef.current.set(n, el);
      });
      if (!dialog) {
        const host = Array.from(document.querySelectorAll<HTMLElement>('.db-savanna-topbar a[href], .db-savanna-topbar button, .db-savanna-topbar select'))
          .filter((el) => el.getClientRects().length > 0);
        host.forEach((el, index) => {
          const n = HOST_NUMBER_START + index;
          el.setAttribute('data-vc-num', String(n));
          numbersRef.current.set(n, el);
        });
      }
    };
    renumber();
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(renumber, 120);
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'disabled'] });
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  // Round-2 finding #1: never take a dictated answer or voice note as a command. Pause while any field (or the
  // sign-language recorder) has the microphone; resume, and continue a guided fill, when it is done.
  useEffect(
    () =>
      onFieldListening((busy) => {
        setPaused(busy);
        if (busy) {
          halt();
          if (onRef.current) setState('paused');
        } else if (onRef.current) {
          setState('listening');
          restartRef.current = setTimeout(() => {
            if (guideRef.current.awaiting === 'answer') fns.current.guideAfterField();
            else listen();
          }, 400);
        }
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

  // Alt+V toggles voice control from anywhere on the page (a modifier shortcut, so it cannot fire by accident).
  useEffect(() => {
    const me = Symbol('voice-control');
    shortcutOwner ??= me;
    const onKey = (event: KeyboardEvent) => {
      if (shortcutOwner !== me || !event.altKey || event.ctrlKey || event.metaKey || event.code !== 'KeyV') return;
      event.preventDefault();
      const active = [...controllers.entries()].find(([, c]) => c.isOn());
      if (active && active[0] !== idRef.current) {
        active[1].turnOff();
        return;
      }
      toggleRef.current?.focus();
      fns.current.toggle();
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

  // Round-2 finding #12: in a noisy room, number keys choose numbered items (never while typing in a field).
  useEffect(() => {
    if (!on) return;
    let buffer = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || !/^[0-9]$/.test(event.key)) return;
      const target = event.composedPath()[0] as HTMLElement | undefined;
      if (target && (target.isContentEditable || target.matches?.('input:not([type="checkbox"]):not([type="radio"]), textarea, select'))) return;
      event.preventDefault();
      buffer += event.key;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const n = Number(buffer);
        buffer = '';
        if (n) fns.current.choose(n, String(n));
      }, 650);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [on]);

  const Icon = on ? EarOff : Ear;
  const commandKeys = ['vc.cmd.numbers', 'vc.cmd.scroll', 'vc.cmd.answer', 'vc.cmd.guide', 'vc.cmd.next', 'vc.cmd.back', 'vc.cmd.repeat', 'vc.cmd.move', 'vc.cmd.choose', 'vc.cmd.switch', 'vc.cmd.stop', 'vc.cmd.keys'];
  const stateView: Record<ListenState, { icon: typeof Mic; key: string }> = {
    listening: { icon: Mic, key: 'vc.state.listening' },
    hearing: { icon: AudioLines, key: 'vc.state.hearing' },
    processing: { icon: Loader, key: 'vc.state.processing' },
    speaking: { icon: Volume2, key: 'vc.state.speaking' },
    paused: { icon: PauseCircle, key: 'vc.state.paused' },
  };
  const shown = paused ? 'paused' : state;
  const StateIcon = stateView[shown].icon;

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
        <div
          className="mt-2 rounded-2xl border-2 border-lagoon bg-lagoon-light p-3 text-lagoon"
          data-vc-paused={paused ? 'true' : 'false'}
          data-vc-state={shown}
        >
          {/* Microphone / processing state pill (round-2 finding #11): always shows whether it is listening or thinking. */}
          <p className="inline-flex items-center gap-2 rounded-full border-2 border-lagoon bg-white px-3 py-1 font-semibold">
            <StateIcon aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {paused ? t('vc.paused') : t(stateView[shown].key)}
          </p>
          {activeItem && (
            <p className="mt-2 rounded-lg border-2 border-ink bg-ink px-3 py-2 font-bold text-white" data-db-active-item="">
              {activeItem}
            </p>
          )}
          {status && <p className="mt-2" data-db-voice-status="">{status}</p>}
          <p className="mt-2 text-sm font-semibold">{t('vc.commandsTitle')}</p>
          <ul className="list-disc ps-5 text-sm">
            {commandKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
