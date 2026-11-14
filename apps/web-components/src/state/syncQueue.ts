import type { OnboardingProfile } from '@db/shared-schemas';
import { onboardingStorage } from './persistence';
import type { ApiClient } from '../api/ApiClient';

type SyncStep = 'consent' | 'name' | 'contact' | 'dob' | 'identity' | 'support';
type SyncProfile = Pick<OnboardingProfile, 'id' | 'partnerId' | 'lang' | 'revision' | 'updatedAt'>;
interface SyncItem {
  id: string;
  profile: SyncProfile;
  step: SyncStep;
  data: unknown;
  revision: number;
  clientUpdatedAt: string;
  attempts: number;
  nextAttemptAt: number;
}

const QUEUE_KEY = 'db:sync-queue';
let activeClient: ApiClient | undefined;
let flushInProgress: Promise<void> | undefined;
let queueMutation: Promise<void> = Promise.resolve();
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let listeningForOnline = false;

async function readQueue(): Promise<SyncItem[]> {
  const raw = await onboardingStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) {
    throw new TypeError('The offline sync queue has an invalid format.');
  }
  return value as SyncItem[];
}

async function writeQueue(queue: SyncItem[]): Promise<void> {
  await onboardingStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function updateQueue(updater: (queue: SyncItem[]) => SyncItem[]): Promise<void> {
  const mutation = queueMutation.catch(() => undefined).then(async () => {
    const queue = await readQueue();
    await writeQueue(updater(queue));
  });
  queueMutation = mutation;
  return mutation;
}

export async function enqueueProfilePatch(
  profile: OnboardingProfile,
  step: SyncStep,
  data: unknown,
): Promise<void> {
  const item: SyncItem = {
    id: `${profile.partnerId}:${profile.id}:${step}:${profile.revision}`,
    profile: {
      id: profile.id,
      partnerId: profile.partnerId,
      lang: profile.lang,
      revision: profile.revision,
      updatedAt: profile.updatedAt,
    },
    step,
    data,
    revision: profile.revision,
    clientUpdatedAt: profile.updatedAt,
    attempts: 0,
    nextAttemptAt: 0,
  };
  await updateQueue((queue) => [...queue.filter((queued) => queued.id !== item.id), item]);
  if (activeClient) void flushSyncQueue();
}

export function removeQueuedProfilePatches(partnerId: string, profileId: string): Promise<void> {
  return updateQueue(
    (queue) => queue.filter((item) => item.profile.partnerId !== partnerId || item.profile.id !== profileId),
  );
}

export function startSyncQueue(client: ApiClient): void {
  activeClient = client;
  if (!listeningForOnline && typeof window !== 'undefined') {
    window.addEventListener('online', () => void flushSyncQueue());
    listeningForOnline = true;
  }
  void flushSyncQueue();
}

export function flushSyncQueue(): Promise<void> {
  if (flushInProgress) return flushInProgress;
  flushInProgress = flushQueue().finally(() => {
    flushInProgress = undefined;
  });
  return flushInProgress;
}

async function flushQueue(): Promise<void> {
  if (!activeClient || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const queue = await readQueue();

  for (const item of queue) {
    if (item.nextAttemptAt > Date.now()) {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void flushSyncQueue();
      }, item.nextAttemptAt - Date.now());
      return;
    }
    try {
      await activeClient.saveStep(item.profile, item.step, item.data, item.revision, item.clientUpdatedAt);
      await updateQueue((current) => current.filter((queued) => queued.id !== item.id));
    } catch (error) {
      const attempts = item.attempts + 1;
      const backoff = Math.min(60_000, 1_000 * 2 ** Math.min(attempts - 1, 6));
      await updateQueue((current) =>
        current.map((queued) =>
          queued.id === item.id
            ? { ...queued, attempts, nextAttemptAt: Date.now() + backoff }
            : queued,
        ),
      );
      console.error('Unable to sync an onboarding step; it remains queued for retry.', error);
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void flushSyncQueue();
      }, backoff);
      return;
    }
  }
}
