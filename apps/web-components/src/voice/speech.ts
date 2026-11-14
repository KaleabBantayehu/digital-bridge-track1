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
