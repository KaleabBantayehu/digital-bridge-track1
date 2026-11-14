import { beforeEach, describe, expect, it, vi } from 'vitest';

const indexedDb = vi.hoisted(() => ({
  values: new Map<string, string>(),
  unavailable: false,
}));

vi.mock('idb-keyval', () => ({
  del: vi.fn(async (key: string) => {
    if (indexedDb.unavailable) throw new Error('IndexedDB unavailable');
    indexedDb.values.delete(key);
  }),
  get: vi.fn(async (key: string) => {
    if (indexedDb.unavailable) throw new Error('IndexedDB unavailable');
    return indexedDb.values.get(key);
  }),
  set: vi.fn(async (key: string, value: string) => {
    if (indexedDb.unavailable) throw new Error('IndexedDB unavailable');
    indexedDb.values.set(key, value);
  }),
}));

import { debouncedOnboardingStorage, onboardingStorage, persistenceKey } from './persistence';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('onboarding persistence', () => {
  let localStorage: MemoryStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    indexedDb.values.clear();
    indexedDb.unavailable = false;
    localStorage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage });
  });

  it('uses the partner and session in its storage key', () => {
    expect(persistenceKey('alx-savanna', 'session-123')).toBe('db:alx-savanna:session-123');
  });

  it('coalesces frequent state writes and saves the latest value within 300 ms', async () => {
    const firstWrite = debouncedOnboardingStorage.setItem('profile', 'first');
    await vi.advanceTimersByTimeAsync(200);
    const secondWrite = debouncedOnboardingStorage.setItem('profile', 'latest');

    await vi.advanceTimersByTimeAsync(99);
    expect(indexedDb.values.has('profile')).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await Promise.all([firstWrite, secondWrite]);

    expect(indexedDb.values.get('profile')).toBe('latest');
  });

  it('falls back to localStorage when IndexedDB is unavailable', async () => {
    indexedDb.unavailable = true;
    await onboardingStorage.setItem('profile', 'saved locally');

    expect(localStorage.getItem('profile')).toBe('saved locally');
    await expect(onboardingStorage.getItem('profile')).resolves.toBe('saved locally');
  });
});
