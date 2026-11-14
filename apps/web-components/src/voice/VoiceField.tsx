import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, Circle, Mic, MicOff, RotateCcw, Square, Trash2, Volume2, X } from 'lucide-react';
import type { Lang } from '@db/shared-schemas';
import { t } from '../i18n';
import { cleanId, ui } from '../wizard/ui';
import {
  blobToDataUrl, canRecordVoiceNote, setFieldListening, getSpeechRecognition, pickAudioMime, speakText, speechLocale, stopSpeaking,
  type SpeechRecognitionLike,
} from './speech';
import { hasVoiceNote, removeVoiceNote, setVoiceNote, useVoiceNotes } from './voiceNotes';
import { FidelHelper } from '../fields/FidelHelper';
import { normaliseSpoken, spellOut, type SpokenKind } from './spokenInput';

export interface VoiceFieldProps {
  lang: Lang;
  /** Visible label of the field this answers, used in "Answer {field} by voice". */
  fieldLabel: string;
  /** Called only when the user presses "Use this answer". Speech is never auto-submitted. */
  onUse: (text: string) => void;
  /** The text input/textarea this mic belongs to; focused when voice is unavailable or after use. */
  targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  announce?: (message: string) => void;
  /**
   * Optional (additive): enables the "Record a voice note instead" fallback (MediaRecorder) and stores a kept note
   * under this key in the voice-notes map. Use for free-text answers such as names and cover notes.
   */
  voiceNoteKey?: string;
  /** Amharic UI: show the Latin -> Fidel helper inside the review box, to fix a misheard name quickly. */
  fidelHelper?: boolean;
  /** What the field holds, so spoken numbers / "at" / "dot" become digits and symbols (default 'text'). */
  spokenKind?: SpokenKind;
}

type Phase = 'idle' | 'listening' | 'review' | 'recording' | 'preview';

/** Longest voice note we keep on the device (keeps a note well inside localStorage limits). */
const MAX_RECORDING_MS = 60_000;
/** Amharic: if speech-to-text has produced nothing after this long, switch to a voice note. */
const AM_EMPTY_TRANSCRIPT_MS = 5_000;
/** Speech-to-text errors that mean "Amharic recognition will not work here" (Guide §5 traps). */
const AM_FALLBACK_ERRORS = new Set(['no-speech', 'network', 'not-allowed', 'language-not-supported', 'service-not-allowed', 'audio-capture']);

/**
 * Mic button + mandatory editable "Review what we heard" step with read-back (CLAUDE.md §3.8, Guide v2 §5),
 * plus a MediaRecorder voice-note fallback that works where speech-to-text does not.
 */
export const VoiceField: React.FC<VoiceFieldProps> = ({ lang, fieldLabel, onUse, targetRef, announce, voiceNoteKey, fidelHelper, spokenKind = 'text' }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [heard, setHeard] = useState('');
  const [note, setNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [recordSupported, setRecordSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const limitRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const amTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startedAtRef = useRef(0);
  const secondsRef = useRef<number | undefined>(undefined);
  const speakingRef = useRef(false);
  const gotResult = useRef(false);
  const reviewRef = useRef<HTMLInputElement>(null);
  const recordBtnRef = useRef<HTMLButtonElement>(null);
  const uid = cleanId(useId());
  const reviewId = `${uid}-review`;
  const savedLabelId = `${uid}-saved`;
  const previewLabelId = `${uid}-preview`;

  const notes = useVoiceNotes();
  const savedNote = voiceNoteKey && hasVoiceNote(notes, voiceNoteKey) ? notes[voiceNoteKey] : '';

  useEffect(() => setRecordSupported(!!voiceNoteKey && canRecordVoiceNote()), [voiceNoteKey]);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  // Stop the microphone, recorder and any read-back on unmount (CLAUDE.md §2.11).
  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      clearTimeout(limitRef.current);
      clearTimeout(amTimerRef.current);
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }
      stopTracks();
      if (speakingRef.current) stopSpeaking();
    },
    [],
  );

  // Free the preview audio when it is replaced or the component goes away.
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (phase === 'review') reviewRef.current?.focus();
    // Tell voice control to stop listening for commands while this field has the microphone.
    setFieldListening(phase === 'listening' || phase === 'recording');
  }, [phase]);
  useEffect(() => () => setFieldListening(false), []);

  const say = (message: string) => {
    setNote(message);
    announce?.(message);
  };

  // ---- Speech to text -------------------------------------------------------------------------------------------
  /**
   * Amharic speech-to-text is missing or broken on many devices (Guide §5). Switch to recording a voice note in the
   * same place, with a plain explanation, or, where recording is impossible too, to typing with the Fidel helper.
   */
  const amharicFallback = () => {
    clearTimeout(amTimerRef.current);
    gotResult.current = true; // the explanation replaces the "nothing heard" note
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
    if (voiceNoteKey && canRecordVoiceNote()) {
      void startRecording(true);
    } else {
      setPhase('idle');
      say(t(lang, 'voice.amFallbackType'));
      targetRef.current?.focus();
    }
  };

  const start = () => {
    setReviewNote('');
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      if (lang === 'am') {
        amharicFallback();
        return;
      }
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
        const raw = Array.from({ length: event.results.length }, (_, i) => event.results[i][0]?.transcript ?? '').join(' ').trim();
        // "ዜሮ ዘጠኝ አንድ…" -> "091…", "name at gmail dot com" -> "name@gmail.com" (still editable before use).
        const transcript = normaliseSpoken(raw, spokenKind);
        if (!transcript) return;
        clearTimeout(amTimerRef.current);
        gotResult.current = true;
        setHeard(transcript);
        setPhase('review');
        say(t(lang, 'voice.heard', { text: transcript }));
      };
      recognition.onerror = (event) => {
        if (recognitionRef.current !== recognition) return; // already switched to a voice note
        if (lang === 'am' && AM_FALLBACK_ERRORS.has(event.error)) {
          amharicFallback();
          return;
        }
        clearTimeout(amTimerRef.current);
        gotResult.current = true; // error already explained; skip the "nothing heard" note
        setPhase('idle');
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') say(t(lang, 'voice.denied'));
        else if (event.error === 'language-not-supported') say(t(lang, 'voice.unsupported'));
        else if (event.error === 'no-speech') say(t(lang, 'voice.nothing'));
        else if (event.error !== 'aborted') say(t(lang, 'voice.error'));
        if (event.error !== 'aborted') targetRef.current?.focus();
      };
      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return; // already switched to a voice note
        clearTimeout(amTimerRef.current);
        recognitionRef.current = null;
        setPhase((p) => (p === 'listening' ? 'idle' : p));
        if (!gotResult.current) say(t(lang, 'voice.nothing'));
      };
      recognitionRef.current = recognition;
      recognition.start();
      setPhase('listening');
      say(t(lang, 'voice.listening'));
      if (lang === 'am') {
        clearTimeout(amTimerRef.current);
        amTimerRef.current = setTimeout(() => {
          if (!gotResult.current && recognitionRef.current === recognition) amharicFallback();
        }, AM_EMPTY_TRANSCRIPT_MS);
      }
    } catch {
      if (lang === 'am') {
        amharicFallback();
        return;
      }
      setPhase('idle');
      say(t(lang, 'voice.error'));
      targetRef.current?.focus();
    }
  };

  const stopListening = () => {
    clearTimeout(amTimerRef.current);
    recognitionRef.current?.stop();
  };

  const useAnswer = () => {
    if (speakingRef.current) stopSpeaking();
    onUse(heard.trim());
    setPhase('idle');
    setHeard('');
    setReviewNote('');
    say(t(lang, 'voice.used'));
    targetRef.current?.focus();
  };

  /** Read the reviewed text back so a blind learner can check what speech recognition wrote. */
  const readBack = () => {
    const ok = speakText(lang, spellOut(heard, spokenKind), () => {
      speakingRef.current = false;
    });
    speakingRef.current = ok;
    const message = t(lang, ok ? 'voice.reading' : 'voice.readBackUnavailable');
    setReviewNote(message);
    announce?.(message);
  };

  const cancelReview = () => {
    if (speakingRef.current) stopSpeaking();
    setPhase('idle');
    setHeard('');
    setNote('');
    setReviewNote('');
    targetRef.current?.focus();
  };

  // ---- Voice note (MediaRecorder) -------------------------------------------------------------------------------
  const startRecording = async (fromAmharicFallback = false) => {
    if (!voiceNoteKey) return;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    secondsRef.current = undefined;
    if (speakingRef.current) stopSpeaking();
    setPreviewUrl('');
    blobRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickAudioMime();
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24_000 });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearTimeout(limitRef.current);
        secondsRef.current = (Date.now() - startedAtRef.current) / 1000;
        stopTracks();
        recorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        if (!blob.size) {
          setPhase('idle');
          say(t(lang, 'note.error'));
          return;
        }
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase('preview');
        say(t(lang, 'note.recorded'));
      };
      recorder.onerror = () => {
        clearTimeout(limitRef.current);
        stopTracks();
        recorderRef.current = null;
        setPhase('idle');
        say(t(lang, 'note.error'));
      };
      recorderRef.current = recorder;
      recorder.start();
      startedAtRef.current = Date.now();
      setPhase('recording');
      say(t(lang, fromAmharicFallback ? 'voice.amFallback' : 'note.recording'));
      // The mic button is disabled while recording; keep keyboard focus on the Stop recording button.
      if (fromAmharicFallback) requestAnimationFrame(() => recordBtnRef.current?.focus());
      limitRef.current = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, MAX_RECORDING_MS);
    } catch (error) {
      stopTracks();
      setPhase('idle');
      const name = (error as { name?: string })?.name;
      say(t(lang, name === 'NotAllowedError' || name === 'SecurityError' ? 'note.denied' : 'note.error'));
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const keepVoiceNote = async () => {
    if (!voiceNoteKey || !blobRef.current) return;
    let saved = false;
    try {
      saved = setVoiceNote(voiceNoteKey, await blobToDataUrl(blobRef.current), secondsRef.current);
    } catch {
      saved = false;
    }
    if (!saved) {
      say(t(lang, 'note.tooBig'));
      return;
    }
    blobRef.current = null;
    setPreviewUrl('');
    setPhase('idle');
    say(t(lang, 'note.kept', { field: fieldLabel }));
    (recordBtnRef.current ?? targetRef.current)?.focus();
  };

  const discardRecording = () => {
    blobRef.current = null;
    setPreviewUrl('');
    setPhase('idle');
    setNote('');
    (recordBtnRef.current ?? targetRef.current)?.focus();
  };

  const deleteVoiceNote = () => {
    if (!voiceNoteKey) return;
    removeVoiceNote(voiceNoteKey);
    say(t(lang, 'note.removed'));
    (recordBtnRef.current ?? targetRef.current)?.focus();
  };

  const listening = phase === 'listening';
  const recording = phase === 'recording';
  const MicIcon = listening ? MicOff : Mic;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={listening ? stopListening : start}
          aria-pressed={listening}
          data-db-action="voice-answer"
          disabled={recording}
          className={ui.btnToggle(listening)}
        >
          <MicIcon aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
          <span>{listening ? t(lang, 'voice.stop') : t(lang, 'voice.answer', { field: fieldLabel })}</span>
        </button>

        {recordSupported && (
          <button
            ref={recordBtnRef}
            type="button"
            onClick={recording ? stopRecording : () => void startRecording()}
            aria-pressed={recording}
            disabled={listening}
            className={ui.btnToggle(recording)}
          >
            {recording ? (
              <Square aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            ) : (
              <Circle aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            )}
            <span>{recording ? t(lang, 'note.stop') : t(lang, 'note.record', { field: fieldLabel })}</span>
          </button>
        )}
      </div>

      {note && phase !== 'review' && <p className="mt-1 text-sm text-stone-800">{note}</p>}

      {phase === 'review' && (
        <div className="mt-3 rounded-xl border-2 border-terracotta bg-white p-3 shadow-card">
          <label htmlFor={reviewId} className={ui.label}>
            {t(lang, 'voice.reviewLabel')}
          </label>
          <input
            id={reviewId}
            ref={reviewRef}
            type="text"
            inputMode={spokenKind === 'tel' ? 'tel' : spokenKind === 'email' ? 'email' : undefined}
            dir={spokenKind === 'text' ? undefined : 'ltr'}
            value={heard} onChange={(e) => setHeard(e.target.value)} className={ui.input} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={useAnswer} disabled={!heard.trim()} className={ui.btnPrimary}>
              <Check aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {t(lang, 'voice.use')}
            </button>
            <button type="button" onClick={readBack} disabled={!heard.trim()} className={ui.btnSecondary}>
              <Volume2 aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {t(lang, 'voice.readBack')}
            </button>
            <button type="button" onClick={start} className={ui.btnSecondary}>
              <RotateCcw aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {t(lang, 'voice.retry')}
            </button>
            <button type="button" onClick={cancelReview} className={ui.btnQuiet}>
              {t(lang, 'common.cancel')}
            </button>
          </div>
          {reviewNote && <p className="mt-2 text-sm text-stone-800">{reviewNote}</p>}
          {fidelHelper && (
            <FidelHelper fieldLabel={t(lang, 'voice.reviewLabel')} value={heard} onChange={setHeard} announce={announce} targetRef={reviewRef} />
          )}
        </div>
      )}

      {phase === 'preview' && previewUrl && (
        <div className="mt-3 rounded-xl border-2 border-terracotta bg-white p-3 shadow-card">
          <p id={previewLabelId} className={ui.label}>
            {t(lang, 'note.previewLabel', { field: fieldLabel })}
          </p>
          <audio controls src={previewUrl} aria-labelledby={previewLabelId} className="w-full max-w-[40rem]" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void keepVoiceNote()} className={ui.btnPrimary}>
              <Check aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {t(lang, 'note.keep')}
            </button>
            <button type="button" onClick={() => void startRecording()} className={ui.btnSecondary}>
              <RotateCcw aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {t(lang, 'note.again')}
            </button>
            <button type="button" onClick={discardRecording} className={ui.btnQuiet}>
              <X aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              {t(lang, 'common.cancel')}
            </button>
          </div>
        </div>
      )}

      {savedNote && phase !== 'preview' && (
        <div className="mt-3 rounded-xl border border-sand bg-white p-3 shadow-card">
          <p id={savedLabelId} className={ui.label}>
            {t(lang, 'note.savedLabel', { field: fieldLabel })}
          </p>
          <audio controls src={savedNote} aria-labelledby={savedLabelId} className="w-full max-w-[40rem]" />
          <button type="button" onClick={deleteVoiceNote} className={`${ui.btnQuiet} mt-2`}>
            <Trash2 aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {t(lang, 'note.remove', { field: fieldLabel })}
          </button>
        </div>
      )}
    </div>
  );
};
