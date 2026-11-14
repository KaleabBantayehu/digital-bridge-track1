import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { JobApplication, JobListing, Lang, OnboardingProfile, SupportFilter } from '@db/shared-schemas';
import type { ApiClient } from '../api/ApiClient';
import { enqueueProfilePatch, removeQueuedProfilePatches } from './syncQueue';
import { debouncedOnboardingStorage, onboardingStorage, persistenceKey } from './persistence';

export interface OnboardingState {
  profile: OnboardingProfile;
  statusMessage: string;
  isOffline: boolean;
  hydrateFromStorage: () => Promise<void>;
  saveStepOfflineFirst: (partial: Partial<OnboardingProfile>) => void;
  requestSmsResume: (client: ApiClient) => Promise<unknown>;
  verifyPartnerVoucher: (
    client: ApiClient,
    referralCode: string,
  ) => Promise<{ status: 'vouched' | 'rejected'; reference: string }>;
  fetchJobs: (client: ApiClient, filters?: SupportFilter[]) => Promise<{ jobs: JobListing[]; count: number }>;
  applyToJob: (client: ApiClient, application: JobApplication) => Promise<unknown>;
  exportMyData: (client: ApiClient) => Promise<unknown>;
  deleteMyData: (client: ApiClient) => Promise<void>;
  setLang: (lang: Lang) => void;
  updateProfile: (partial: Partial<OnboardingProfile>) => void;
  setStep: (step: number) => void;
  setStatusMessage: (msg: string) => void;
  setProfileIdentity: (partnerId: string, sessionId: string) => void;
}

function createInitialProfile(partnerId = 'alx-demo', sessionId = 'local-session-1'): OnboardingProfile {
  return {
    id: sessionId,
    partnerId,
    lang: 'en',
    consent: {
      saveAnswers: false,
      smsResume: false,
      shareWithEmployers: false,
      givenAt: new Date().toISOString(),
    },
    name: { givenName: '', familyName: '' },
    contact: {},
    progress: { currentStep: 0, totalSteps: 6, completedSteps: [] },
    revision: 1,
    updatedAt: new Date().toISOString(),
  };
}

const syncStepByProfileField = {
  consent: 'consent',
  name: 'name',
  contact: 'contact',
  dateOfBirth: 'dob',
  identity: 'identity',
  support: 'support',
} as const;

let activeScope: string | undefined;
let scopeChange: Promise<void> = Promise.resolve();

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      profile: createInitialProfile(),
      statusMessage: '',
      isOffline: false,
      hydrateFromStorage: async () => {
        await useOnboardingStore.persist.rehydrate();
      },
      saveStepOfflineFirst: (partial) => get().updateProfile(partial),
      requestSmsResume: (client) => client.requestResumeSms(get().profile),
      verifyPartnerVoucher: (client, referralCode) => client.verifyPartnerVoucher(referralCode),
      fetchJobs: (client, filters = []) => client.getJobs(filters),
      applyToJob: (client, application) => client.apply(application),
      exportMyData: (client) => client.exportMyData(get().profile),
      deleteMyData: async (client) => {
        const { profile } = get();
        await client.deleteMyData(profile);
        await removeQueuedProfilePatches(profile.partnerId, profile.id);
        await onboardingStorage.removeItem(persistenceKey(profile.partnerId, profile.id));
        set({
          profile: createInitialProfile(profile.partnerId, profile.id),
          statusMessage: profile.lang === 'am' ? 'የተቀመጠው መረጃ ተሰርዟል።' : 'Your saved data has been deleted.',
        });
      },
      setLang: (lang) =>
        set((state) => ({
          profile: { ...state.profile, lang, updatedAt: new Date().toISOString() },
        })),
      updateProfile: (partial) => {
        set((state) => ({
          profile: {
            ...state.profile,
            ...partial,
            consent: partial.consent ? { ...state.profile.consent, ...partial.consent } : state.profile.consent,
            name: partial.name ? { ...state.profile.name, ...partial.name } : state.profile.name,
            contact: partial.contact ? { ...state.profile.contact, ...partial.contact } : state.profile.contact,
            progress: partial.progress ? { ...state.profile.progress, ...partial.progress } : state.profile.progress,
            revision: state.profile.revision + 1,
            updatedAt: new Date().toISOString(),
          },
          statusMessage:
            state.profile.lang === 'am'
              ? 'መልስዎ በዚህ መሣሪያ ላይ ተቀምጧል።'
              : 'Your answer is saved on this device.',
        }));

        const { profile } = get();
        for (const [field, step] of Object.entries(syncStepByProfileField)) {
          if (Object.prototype.hasOwnProperty.call(partial, field)) {
            const data = partial[field as keyof OnboardingProfile];
            void enqueueProfilePatch(profile, step, data).catch((error: unknown) => {
              console.error('Unable to persist an onboarding update in the offline queue.', error);
            });
          }
        }
      },
      setStep: (currentStep) =>
        set((state) => ({
          profile: {
            ...state.profile,
            progress: {
              ...state.profile.progress,
              currentStep,
              completedSteps: Array.from(
                new Set([...state.profile.progress.completedSteps, state.profile.progress.currentStep]),
              ),
            },
          },
        })),
      setStatusMessage: (statusMessage) => set({ statusMessage }),
      setProfileIdentity: (partnerId, sessionId) =>
        set((state) => ({
          profile: { ...state.profile, partnerId, id: sessionId },
        })),
    }),
    {
      name: persistenceKey('alx-demo', 'local-session-1'),
      storage: createJSONStorage(() => debouncedOnboardingStorage),
      skipHydration: true,
    },
  ),
);

export function setPersistenceScope(partnerId: string, sessionId: string): Promise<void> {
  const key = persistenceKey(partnerId, sessionId);
  if (activeScope === key) return Promise.resolve();

  const transition = scopeChange.catch(() => undefined).then(async () => {
    if (activeScope === key) return;
    useOnboardingStore.persist.setOptions({ name: key });
    const savedState = await onboardingStorage.getItem(key);
    await useOnboardingStore.persist.rehydrate();
    if (!savedState) {
      useOnboardingStore.setState({
        profile: createInitialProfile(partnerId, sessionId),
        statusMessage: '',
        isOffline: false,
      });
    } else {
      useOnboardingStore.getState().setProfileIdentity(partnerId, sessionId);
    }
    activeScope = key;
  });

  scopeChange = transition;
  return transition;
}
