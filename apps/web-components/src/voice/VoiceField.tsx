import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, Mic, MicOff, RotateCcw } from 'lucide-react';
import type { Lang } from '@db/shared-schemas';
import { t } from '../i18n';
import { cleanId, ui } from '../wizard/ui';
import { getSpeechRecognition, speechLocale, type SpeechRecognitionLike } from './speech';

export interface VoiceFieldProps {
  lang: Lang;
  /** Visible label of the field this answers, used in "Answer {field} by voice". */
  fieldLabel: string;
  /** Called only when the user presses "Use this answer". Speech is never auto-submitted. */
  onUse: (text: string) => void;
  /** The text input/textarea this mic belongs to; focused when voice is unavailable or after use. */
  targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  announce?: (message: string) => void;
}

type Phase = 'idle' | 'listening' | 'review';

/** Mic button + mandatory editable "Review what we heard" step (WCAG 3.3.4 spirit, CLAUDE.md §3.8). */
export const VoiceField: React.FC<VoiceFieldProps> = ({ lang, fieldLabel, onUse, targetRef, announce }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [heard, setHeard] = useState('');
  const [note, setNote] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const gotResult = useRef(false);
  const reviewRef = useRef<HTMLInputElement>(null);
  const reviewId = cleanId(useId());

  // Stop the microphone on unmount (CLAUDE.md §2.11).
  useEffect(() => () => recognitionRef.current?.abort(), []);

  useEffect(() => {
    if (phase === 'review') reviewRef.current?.focus();
  }, [phase]);

  const say = (message: string) => {
    setNote(message);
    announce?.(message);
  };

  const start = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      say(t(lang, 'voice.unsupported'));
      targetRef.current?.focus();
      return;
    }
    try {
      const recognition = new Recognition();
      recognition.lang = speechLocale(lang);
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      gotResult.current = false;
      recognition.onresult = (event) => {
        const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i][0]?.transcript ?? '').join(' ').trim();
        if (!transcript) return;
        gotResult.current = true;
        setHeard(transcript);
        setPhase('review');
        say(t(lang, 'voice.heard', { text: transcript }));
      };
      recognition.onerror = (event) => {
        gotResult.current = true; // error already explained; skip the "nothing heard" note
        setPhase('idle');
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') say(t(lang, 'voice.denied'));
        else if (event.error === 'language-not-supported') say(t(lang, 'voice.unsupported'));
        else if (event.error === 'no-speech') say(t(lang, 'voice.nothing'));
        else if (event.error !== 'aborted') say(t(lang, 'voice.error'));
        if (event.error !== 'aborted') targetRef.current?.focus();
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        setPhase((p) => (p === 'listening' ? 'idle' : p));
        if (!gotResult.current) say(t(lang, 'voice.nothing'));
      };
      recognitionRef.current = recognition;
      recognition.start();
      setPhase('listening');
      say(t(lang, 'voice.listening'));
    } catch {
      setPhase('idle');
      say(t(lang, 'voice.error'));
      targetRef.current?.focus();
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const useAnswer = () => {
    onUse(heard.trim());
    setPhase('idle');
    setHeard('');
    say(t(lang, 'voice.used'));
    targetRef.current?.focus();
  };

  const listening = phase === 'listening';
  const MicIcon = listening ? MicOff : Mic;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={listening ? stopListening : start}
        aria-pressed={listening}
        className={ui.btnToggle(listening)}
      >
        <MicIcon aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
        <span>{listening ? t(lang, 'voice.stop') : t(lang, 'voice.answer', { field: fieldLabel })}</span>
      </button>

      {note && phase !== 'review' && <p className="mt-1 text-sm text-stone-800">{note}</p>}

      {phase === 'review' && (
        <div className="mt-3 rounded-md border-2 border-terracotta bg-white p-3">
          <label htmlFor={reviewId} className={ui.label}>
            {t(lang, 'voice.reviewLabel')}
          </label>
          <input id={reviewId} ref={reviewRef} type="text" value={heard} onChange={(e) => setHeard(e.target.value)} className={ui.input} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={useAnswer} disabled={!heard.trim()} className={ui.btnPrimary}>
              <Check aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {t(lang, 'voice.use')}
            </button>
            <button type="button" onClick={start} className={ui.btnSecondary}>
              <RotateCcw aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {t(lang, 'voice.retry')}
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase('idle');
                setHeard('');
                setNote('');
                targetRef.current?.focus();
              }}
              className={ui.btnQuiet}
            >
              {t(lang, 'common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
