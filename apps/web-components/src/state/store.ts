import { create } from "zustand";
import { OnboardingProfile, Lang } from "@db/shared-schemas";

export interface OnboardingState {
  profile: OnboardingProfile;
  statusMessage: string;
  isOffline: boolean;
  setLang: (lang: Lang) => void;
  updateProfile: (partial: Partial<OnboardingProfile>) => void;
  setStep: (step: number) => void;
  setStatusMessage: (msg: string) => void;
}

const initialProfile: OnboardingProfile = {
  id: "local-session-1",
  partnerId: "alx-demo",
  lang: "en",
  consent: { saveAnswers: false, smsResume: false, shareWithEmployers: false, givenAt: new Date().toISOString() },
  name: { givenName: "", familyName: "" },
  contact: {},
  progress: { currentStep: 0, totalSteps: 6, completedSteps: [] },
  revision: 1,
  updatedAt: new Date().toISOString(),
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  profile: initialProfile,
  statusMessage: "",
  isOffline: false,
  setLang: (lang) => set((s) => ({ profile: { ...s.profile, lang, updatedAt: new Date().toISOString() } })),
  updateProfile: (partial) =>
    set((s) => ({
      profile: { ...s.profile, ...partial, revision: s.profile.revision + 1, updatedAt: new Date().toISOString() },
      statusMessage: s.profile.lang === "am" ? "???? ??? ???? ?? ??????" : "Your answer is saved on this device.",
    })),
  setStep: (currentStep) =>
    set((s) => ({
      profile: {
        ...s.profile,
        progress: {
          ...s.profile.progress,
          currentStep,
          completedSteps: Array.from(new Set([...s.profile.progress.completedSteps, s.profile.progress.currentStep])),
        },
      },
    })),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
}));
