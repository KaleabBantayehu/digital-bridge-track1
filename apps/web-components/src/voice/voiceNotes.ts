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

// Recording length per note, kept beside (not inside) the notes map so the map stays field -> data URL.
const metaKey = () => `${storageKey()}Meta`;

function readSeconds(): Record<string, number> {
  try {
    const raw = localStorage.getItem(metaKey());
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeSeconds(meta: Record<string, number>): void {
  try {
    if (Object.keys(meta).length) localStorage.setItem(metaKey(), JSON.stringify(meta));
    else localStorage.removeItem(metaKey());
  } catch {
    // Length is a nice-to-have label; the note itself is already saved.
  }
}

/** Whole seconds of a kept note, if we measured it while recording. */
export const getVoiceNoteSeconds = (field: string): number | undefined => readSeconds()[field];

/** Returns false when the note could not be saved (e.g. storage full). */
export function setVoiceNote(field: string, dataUrl: string, seconds?: number): boolean {
  const ok = write({ ...getVoiceNotes(), [field]: dataUrl });
  if (ok && seconds !== undefined) writeSeconds({ ...readSeconds(), [field]: Math.max(1, Math.round(seconds)) });
  return ok;
}

export function removeVoiceNote(field: string): void {
  const { [field]: _removed, ...rest } = getVoiceNotes();
  const { [field]: _seconds, ...restSeconds } = readSeconds();
  writeSeconds(restSeconds);
  write(rest);
}

/** "Delete my data": remove every kept note and its metadata from this device. */
export function clearVoiceNotes(): void {
  writeSeconds({});
  write({});
}

/** Keys that belong to other flows (job applications, employer forms), not to the onboarding profile. */
const NON_PROFILE_PREFIXES = ['coverNote:', 'employer:'];

/** Voice notes that answer onboarding questions (what `db-signup:done` carries). */
export function profileVoiceNotes(): VoiceNotes {
  return Object.fromEntries(
    Object.entries(getVoiceNotes()).filter(([key]) => !NON_PROFILE_PREFIXES.some((prefix) => key.startsWith(prefix))),
  );
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
