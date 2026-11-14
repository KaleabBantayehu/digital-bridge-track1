import React, { useEffect, useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import type { Lang } from '@db/shared-schemas';
import { t } from '../i18n';
import { cx, ui } from '../wizard/ui';
import { resolvePromptClip } from './promptAudio';

export interface ReadAloudButtonProps {
  lang: Lang;
  /** Text to speak (already in `lang`). */
  text: string;
  /** Key of a bundled pre-recorded clip: /audio/{lang}/{promptKey}.mp3, used when no TTS voice exists for the language. */
  promptKey?: string;
  /** Accessible, unique name when there are several on a page (e.g. per job card). Defaults to "Read aloud". */
  label?: string;
  announce?: (message: string) => void;
  audioBaseUrl?: string;
  className?: string;
}

function findVoice(lang: string): SpeechSynthesisVoice | undefined {
  const prefix = lang.toLowerCase().split('-')[0];
  return window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(prefix));
}

/** Read aloud via speechSynthesis, falling back to bundled audio, then to a visible note. Never auto-speaks. */
export const ReadAloudButton: React.FC<ReadAloudButtonProps> = ({ lang, text, promptKey, label, announce, audioBaseUrl = '', className }) => {
  const [speaking, setSpeaking] = useState(false);
  const [note, setNote] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  };

  // Stop speaking on unmount, step change or language change.
  useEffect(() => stop, [text, lang]);

  const playClip = async () => {
    const clip = promptKey ? await resolvePromptClip(lang, promptKey, audioBaseUrl) : null;
    if (!clip) {
      setNote(t(lang, 'help.noVoice'));
      return;
    }
    const audio = new Audio(clip);
    audioRef.current = audio;
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => {
      setSpeaking(false);
      setNote(t(lang, 'help.noVoice'));
    };
    setSpeaking(true);
    audio.play().catch(() => {
      setSpeaking(false);
      setNote(t(lang, 'help.noVoice'));
    });
  };

  const start = () => {
    setNote('');
    const hasTts = typeof window !== 'undefined' && 'speechSynthesis' in window;
    const voice = hasTts ? findVoice(lang) : undefined;
    if (!hasTts || !voice) {
      if (!hasTts && lang === 'en' && !promptKey) {
        setNote(t(lang, 'help.noTts'));
        return;
      }
      void playClip();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice.lang;
    utterance.voice = voice;
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
    announce?.(t(lang, 'help.reading'));
  };

  const toggle = () => {
    if (speaking) {
      stop();
      announce?.(t(lang, 'help.stopped'));
    } else {
      start();
    }
  };

  const Icon = speaking ? Square : Volume2;
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={speaking}
        aria-label={label && !speaking ? label : undefined}
        className={cx(ui.btnToggle(speaking), className)}
      >
        <Icon aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
        <span>{speaking ? t(lang, 'help.stopReading') : t(lang, 'help.readAloud')}</span>
      </button>
      {note && <span className="mt-1 text-sm text-stone-700 max-w-[20rem]">{note}</span>}
      {speaking && (
        <p className="mt-2 max-w-[32rem] rounded-lg border-2 border-terracotta bg-white px-3 py-2 text-base leading-relaxed text-ink" role="status" aria-live="polite">
          {text}
        </p>
      )}
    </span>
  );
};
