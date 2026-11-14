import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, Square, Volume2 } from 'lucide-react';
import type { Lang } from '@db/shared-schemas';
import { t } from '../i18n';
import { cx, ui } from '../wizard/ui';
import { findSynthVoice, playChime, splitPhrases } from '../voice/speech';
import { resolvePromptClip } from './promptAudio';

export interface ReadAloudButtonProps {
  lang: Lang;
  /** Text to speak (already in `lang`). */
  text: string;
  /** Key of a recorded clip listed in {audioBaseUrl}/audio/{lang}/manifest.json, used when no TTS voice exists. */
  promptKey?: string;
  /** Accessible, unique name when there are several on a page (e.g. per job card). Defaults to "Read aloud". */
  label?: string;
  announce?: (message: string) => void;
  audioBaseUrl?: string;
  className?: string;
  /** Pill styling (help cluster). */
  pill?: boolean;
  /**
   * Where the on-screen read-aloud panel is rendered. The help cluster passes a node placed after all of its
   * buttons, so the panel never sits between them in the focus order (2.4.3, 3.2.6).
   */
  panelSlot?: HTMLElement | null;
  /** Hook for voice control ("repeat" presses the step's Read aloud button). */
  actionId?: string;
}

/** 'tts': an installed voice speaks phrase by phrase. 'visual': a bundled cue or chime, then timed phrases. */
type Mode = 'idle' | 'tts' | 'visual';

/** On-screen pace: long enough to read comfortably, scaled to the phrase length. */
const phraseMs = (phrase: string) => Math.max(2200, Array.from(phrase).length * 90);

/**
 * Read aloud, never on page load (CLAUDE.md §3.8). The caption box below the toolbar ALWAYS shows the words, with the
 * current phrase highlighted, so it also works with the sound off (Guide §8 gate) and for Deaf learners. Sound:
 * 1. speechSynthesis with an installed voice for the language, one phrase at a time (highlight follows the voice);
 * 2. otherwise a bundled cue listed in the audio manifest (never requested unless listed, so no 404s),
 *    or a soft synthesised chime, while the highlight moves through the phrases on a reading-pace timer.
 */
export const ReadAloudButton: React.FC<ReadAloudButtonProps> = ({
  lang, text, promptKey, label, announce, audioBaseUrl, className, pill, panelSlot, actionId,
}) => {
  const [mode, setMode] = useState<Mode>('idle');
  const [phrases, setPhrases] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const runRef = useRef(0);

  const active = mode !== 'idle';

  const stop = () => {
    runRef.current += 1; // cancels any pending async start
    clearTimeout(timerRef.current);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
    setMode('idle');
    setPaused(false);
  };

  // Stop on unmount, step change or language change.
  useEffect(() => stop, [text, lang]);

  // No voice: advance one phrase at a time unless paused.
  useEffect(() => {
    if (mode !== 'visual' || paused) return;
    timerRef.current = setTimeout(() => {
      if (index + 1 < phrases.length) {
        playChime('next');
        setIndex(index + 1);
      } else {
        setMode('idle');
        announce?.(t(lang, 'readAloud.done'));
      }
    }, phraseMs(phrases[index] ?? ''));
    return () => clearTimeout(timerRef.current);
  }, [mode, paused, index, phrases, lang, announce]);

  const startVisual = (parts: string[]) => {
    setPhrases(parts);
    setIndex(0);
    setPaused(false);
    setMode('visual');
    announce?.(t(lang, 'readAloud.visualNote'));
  };

  const start = async () => {
    const run = ++runRef.current;
    const parts = splitPhrases(text);
    const shown = parts.length ? parts : [text];
    const voice = findSynthVoice(lang);
    if (voice) {
      window.speechSynthesis.cancel();
      setPhrases(shown);
      setIndex(0);
      setPaused(false);
      setMode('tts');
      shown.forEach((phrase, i) => {
        const utterance = new SpeechSynthesisUtterance(phrase);
        utterance.lang = voice.lang;
        utterance.voice = voice;
        utterance.rate = 0.9;
        utterance.onstart = () => setIndex(i);
        if (i === shown.length - 1) utterance.onend = () => setMode((m) => (m === 'tts' ? 'idle' : m));
        utterance.onerror = () => setMode((m) => (m === 'tts' ? 'idle' : m));
        window.speechSynthesis.speak(utterance);
      });
      announce?.(t(lang, 'help.reading'));
      return;
    }
    const clip = promptKey ? await resolvePromptClip(lang, promptKey, audioBaseUrl) : null;
    if (run !== runRef.current) return; // stopped while looking up the clip
    if (clip) {
      const audio = new Audio(clip);
      audioRef.current = audio;
      audio.play().catch(() => playChime('start')); // autoplay/codec refused: the chime still confirms
    } else {
      playChime('start');
    }
    startVisual(shown);
  };

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    if (mode === 'tts') {
      if (next) window.speechSynthesis.pause();
      else window.speechSynthesis.resume();
    }
  };

  const toggle = () => {
    if (active) {
      stop();
      announce?.(t(lang, 'help.stopped'));
    } else {
      void start();
    }
  };

  const Icon = active ? Square : Volume2;
  const toggleClass = pill ? ui.btnPillToggle(active) : ui.btnToggle(active);

  const panel =
    active ? (
      <div className="mt-3 basis-full rounded-2xl border-2 border-terracotta bg-white p-4 shadow-card">
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-terracotta-dark">
          <span>{t(lang, 'readAloud.visualTitle')}</span>
          <span>{t(lang, 'readAloud.phraseOf', { current: index + 1, total: phrases.length })}</span>
        </p>
        {mode === 'visual' && <p className="mt-1 text-sm text-stone-700">{t(lang, 'readAloud.visualNote')}</p>}
        <p className="mt-3 text-[1.375rem] leading-relaxed text-ink" data-db-caption="">
          {phrases.map((phrase, i) => (
            <React.Fragment key={i}>
              {i === index ? <mark className="db-phrase-current px-1">{phrase}</mark> : <span className="text-stone-700">{phrase}</span>}{' '}
            </React.Fragment>
          ))}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={togglePause} aria-pressed={paused} className={ui.btnPillToggle(paused)}>
            {paused ? (
              <Play aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            ) : (
              <Pause aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            )}
            {paused ? t(lang, 'readAloud.resume') : t(lang, 'readAloud.pause')}
          </button>
          <button
            type="button"
            onClick={() => {
              stop();
              announce?.(t(lang, 'help.stopped'));
            }}
            className={ui.btnPill}
          >
            <Square aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {t(lang, 'help.stopReading')}
          </button>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={active}
        data-db-action={actionId}
        aria-label={label && !active ? label : undefined}
        className={cx(toggleClass, className)}
      >
        <Icon aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
        <span>{active ? t(lang, 'help.stopReading') : t(lang, 'help.readAloud')}</span>
      </button>
      {panel && (panelSlot ? createPortal(panel, panelSlot) : panel)}
    </>
  );
};
