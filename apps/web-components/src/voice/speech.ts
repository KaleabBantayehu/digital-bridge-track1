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
