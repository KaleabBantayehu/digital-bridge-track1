import { del, get, set } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

function localStorageIfAvailable(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export const onboardingStorage: StateStorage = {
  async getItem(name) {
    try {
      const value = await get<string>(name);
      if (value !== undefined) return value;
    } catch (indexedDbError) {
      const fallback = localStorageIfAvailable();
      if (!fallback) throw indexedDbError;
      try {
        return fallback.getItem(name);
      } catch {
        throw indexedDbError;
      }
    }

    return localStorageIfAvailable()?.getItem(name) ?? null;
  },
  async setItem(name, value) {
    try {
      await set(name, value);
    } catch (indexedDbError) {
      const fallback = localStorageIfAvailable();
      if (!fallback) throw indexedDbError;
      try {
        fallback.setItem(name, value);
      } catch (localStorageError) {
        throw new AggregateError([indexedDbError, localStorageError], 'Unable to persist onboarding data.');
      }
    }
  },
  async removeItem(name) {
    try {
      await del(name);
    } catch (indexedDbError) {
      const fallback = localStorageIfAvailable();
      if (!fallback) throw indexedDbError;
      try {
        fallback.removeItem(name);
      } catch (localStorageError) {
        throw new AggregateError([indexedDbError, localStorageError], 'Unable to remove onboarding data.');
      }
    }
  },
};

interface PendingWrite {
  value: string;
  firstQueuedAt: number;
  timer: ReturnType<typeof setTimeout>;
  waiters: { resolve: () => void; reject: (error: unknown) => void }[];
}

const pendingWrites = new Map<string, PendingWrite>();

export const debouncedOnboardingStorage: StateStorage = {
  ...onboardingStorage,
  setItem(name, value) {
    return new Promise<void>((resolve, reject) => {
      const now = Date.now();
      const pending = pendingWrites.get(name);
      if (pending) {
        clearTimeout(pending.timer);
        pending.value = value;
        pending.waiters.push({ resolve, reject });
        pending.timer = setTimeout(
          () => void flushPendingWrite(name),
          Math.max(0, Math.min(250, pending.firstQueuedAt + 300 - now)),
        );
        return;
      }

      const entry: PendingWrite = {
        value,
        firstQueuedAt: now,
        timer: setTimeout(() => void flushPendingWrite(name), 250),
        waiters: [{ resolve, reject }],
      };
      pendingWrites.set(name, entry);
    });
  },
};

async function flushPendingWrite(name: string): Promise<void> {
  const pending = pendingWrites.get(name);
  if (!pending) return;
  pendingWrites.delete(name);

  try {
    await onboardingStorage.setItem(name, pending.value);
    pending.waiters.forEach(({ resolve }) => resolve());
  } catch (error) {
    pending.waiters.forEach(({ reject }) => reject(error));
  }
}

export function persistenceKey(partnerId: string, sessionId: string): string {
  return `db:${partnerId}:${sessionId}`;
}
