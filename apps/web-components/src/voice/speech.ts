import type { Lang } from '@db/shared-schemas';

// Minimal Web Speech API typings (not shipped in TypeScript's DOM lib).
export interface SpeechRecognitionAlternativeLike { transcript: string; confidence: number }
export interface SpeechRecognitionResultLike { readonly length: number; [index: number]: SpeechRecognitionAlternativeLike; isFinal: boolean }
export interface SpeechRecognitionEventLike extends Event { results: { readonly length: number; [index: number]: SpeechRecognitionResultLike } }
export interface SpeechRecognitionErrorEventLike extends Event { error: string }
export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechLocale = (lang: Lang) => (lang === 'am' ? 'am-ET' : 'en-US');

/** Find an installed speech-synthesis voice for the language (Amharic is often missing on Windows/Android). */
export function findSynthVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;
  const prefix = lang === 'am' ? 'am' : 'en';
  return window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(prefix));
}

/**
 * Read text back with speechSynthesis. Returns false (caller shows a visible note) when there is no engine
 * or no voice for the language, so Amharic is never read with an English voice.
 */
export function speakText(lang: Lang, text: string, onEnd?: () => void): boolean {
  const voice = findSynthVoice(lang);
  if (!voice || !text.trim()) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

/** Voice-note fallback (Guide v2 §5): works where speech-to-text does not. */
export function canRecordVoiceNote(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/** Small, widely supported audio type: Opus in WebM (Chrome/Android), MP4/AAC (Safari), else browser default. */
export function pickAudioMime(): string | undefined {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return types.find((type) => window.MediaRecorder.isTypeSupported?.(type));
}

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// ---- Visual read-aloud helpers (no installed voice for the language) ----------------------------------------------

/** Split text into short phrases for the on-screen read-aloud (Ethiopic ። ፣ ፤ and Latin punctuation). */
export function splitPhrases(text: string): string[] {
  return text
    .split(/(?<=[.!?።፧፨;፤])\s+|\n+/)
    .map((phrase) => phrase.trim())
    .filter(Boolean);
}

let audioContext: AudioContext | null = null;

/**
 * A short, quiet two-note chime synthesised with Web Audio. No audio file is needed, so it never 404s and works
 * offline. Silently does nothing where Web Audio is unavailable.
 */
export function playChime(kind: 'start' | 'next' = 'next'): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioContext ??= new Ctor();
    const ctx = audioContext;
    if (ctx.state === 'suspended') void ctx.resume();
    const notes = kind === 'start' ? [660, 880] : [740];
    notes.forEach((frequency, index) => {
      const at = ctx.currentTime + index * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.4);
    });
  } catch {
    // Sound is a bonus; the on-screen highlight still works.
  }
}

// ---- Microphone hand-off between voice control (commands) and a field's own dictation / voice note ---------------
let fieldBusy = false;
const busyListeners = new Set<(busy: boolean) => void>();

/** A field started (true) or finished (false) dictation or a voice-note recording. */
export function setFieldListening(busy: boolean): void {
  if (fieldBusy === busy) return;
  fieldBusy = busy;
  busyListeners.forEach((listener) => listener(busy));
}

export const isFieldListening = () => fieldBusy;

/** Voice control pauses while a field is listening, so a spoken answer is never taken as a command. */
export function onFieldListening(listener: (busy: boolean) => void): () => void {
  busyListeners.add(listener);
  return () => busyListeners.delete(listener);
}
