import { useSyncExternalStore } from 'react';
import type { VoiceNotes } from '@db/shared-schemas';
import { useOnboardingStore } from '../state/store';

/**
 * Voice notes the learner chose to keep (Technical Guide v2 §5: "let the learner ... keep the voice note in its place").
 * Stored on this device only, under the `db:` prefix so "Delete my data" (services.deleteAllData) removes them too.
 * Key format follows CLAUDE.md §7: db:{partnerId}:{profileId}:voiceNotes.
 */
const EMPTY: VoiceNotes = {};
let cache: { key: string; notes: VoiceNotes } | null = null;
const listeners = new Set<() => void>();

function storageKey(): string {
  const { partnerId, id } = useOnboardingStore.getState().profile;
  return `db:${partnerId || 'local'}:${id || 'draft'}:voiceNotes`;
}

function read(key: string): VoiceNotes {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as VoiceNotes) : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function getVoiceNotes(): VoiceNotes {
  const key = storageKey();
  if (!cache || cache.key !== key) cache = { key, notes: read(key) };
  return cache.notes;
}

function write(notes: VoiceNotes): boolean {
  const key = storageKey();
  try {
    if (Object.keys(notes).length) localStorage.setItem(key, JSON.stringify(notes));
    else localStorage.removeItem(key);
  } catch {
    return false; // quota exceeded or storage blocked: caller tells the learner
  }
  cache = { key, notes };
  listeners.forEach((l) => l());
  return true;
}

/** Returns false when the note could not be saved (e.g. storage full). */
export const setVoiceNote = (field: string, dataUrl: string): boolean => write({ ...getVoiceNotes(), [field]: dataUrl });

export function removeVoiceNote(field: string): void {
  const { [field]: _removed, ...rest } = getVoiceNotes();
  write(rest);
}

/** Drop the in-memory copy (after "Delete my data" cleared storage). */
export function resetVoiceNotes(): void {
  cache = null;
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.endsWith(':voiceNotes')) resetVoiceNotes();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export const useVoiceNotes = (): VoiceNotes => useSyncExternalStore(subscribe, getVoiceNotes, () => EMPTY);

export const hasVoiceNote = (notes: VoiceNotes, field: string) => typeof notes[field] === 'string' && notes[field].startsWith('data:');
