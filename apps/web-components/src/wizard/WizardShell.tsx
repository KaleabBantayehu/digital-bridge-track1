import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, Contact, HeartHandshake, Phone, ShieldCheck, User, Users, WifiOff,
} from 'lucide-react';
import {
  DB_EVENTS, SIGNUP_EVENTS, type Lang, type OnboardingProfile, type SignupDoneDetail, type SignupStepDetail, type SignupSupportDetail,
} from '@db/shared-schemas';
import { useOnboardingStore } from '../state/store';
import { errorText, makeT, t as translate } from '../i18n';
import { LiveRegion, useAnnouncer } from './LiveRegion';
import { StepHeading } from './StepHeading';
import { ProgressBar } from './ProgressBar';
import { ErrorSummary, type ErrorSummaryItem } from './ErrorSummary';
import { HelpCluster } from './HelpCluster';
import { PrivacyDrawer } from './PrivacyDrawer';
import { emitEvent } from './emit';
import { localServices, type Dev2Services } from './services';
import { FIELD_LABELS, fieldId, type FieldErrors, type StepDefinition, type StepProps } from './types';
import { normaliseStep, partnerDraftFrom, validateStep, type PartnerDraft } from './validation';
import { cleanId, cx, ui } from './ui';
import { VoiceControl } from './VoiceControl';
import { ETHIOPIC_CSS, scriptClass } from '../i18n/script';
import { clearVoiceNotes, getVoiceNotes, profileVoiceNotes } from '../voice/voiceNotes';
import { WelcomeConsentStep } from './steps/WelcomeConsentStep';
import { NameStep } from './steps/NameStep';
import { ContactStep } from './steps/ContactStep';
import { DateOfBirthStep } from './steps/DateOfBirthStep';
import { IdentityStep } from './steps/IdentityStep';
import { SupportStep } from './steps/SupportStep';
import { ReviewStep } from './steps/ReviewStep';

export interface WizardShellProps {
  apiUrl?: string;
  partnerId?: string;
  lang?: Lang;
  theme?: "terracotta" | "high-contrast";
  /** "edit" (additive, Guide v2 §5): mounted from profile.html as the "My Profile" editor; opens on the summary. */
  mode?: "standalone" | "lti" | "partner-assisted" | "edit";
  ltiToken?: string;
  sessionId?: string;
  onDispatch?: (eventName: string, detail: unknown) => void;
  /** Optional (additive): inject Dev 1's ApiClient-backed services. Defaults to the local/offline implementation. */
  services?: Dev2Services;
  /** Optional (additive): base URL for bundled /audio/{lang}/{key}.mp3 read-aloud clips. */
  audioBaseUrl?: string;
}

const STEP_IDS = ['consent', 'name', 'contact', 'dob', 'identity', 'support', 'review'] as const;
const TOTAL_STEPS = STEP_IDS.length; // 7 screens: Steps 0–6

const STEPS: (StepDefinition & { Component: React.FC<StepProps>; Icon: typeof User })[] = [
  { titleKey: 'step0.title', hintKey: 'step0.hint', simpleHintKey: 'step0.hint.simple', Component: WelcomeConsentStep, Icon: ShieldCheck },
  { titleKey: 'step1.title', hintKey: 'step1.hint', simpleHintKey: 'step1.hint.simple', Component: NameStep, Icon: User },
  { titleKey: 'step2.title', hintKey: 'step2.hint', simpleHintKey: 'step2.hint.simple', Component: ContactStep, Icon: Phone },
  { titleKey: 'step3.title', hintKey: 'step3.hint', simpleHintKey: 'step3.hint.simple', Component: DateOfBirthStep, Icon: CalendarDays },
  { titleKey: 'step4.title', hintKey: 'step4.hint', simpleHintKey: 'step4.hint.simple', Component: IdentityStep, Icon: Contact },
  { titleKey: 'step5.title', hintKey: 'step5.hint', simpleHintKey: 'step5.hint.simple', Component: SupportStep, Icon: HeartHandshake },
  { titleKey: 'step6.title', hintKey: 'step6.hint', simpleHintKey: 'step6.hint.simple', Component: ReviewStep, Icon: ClipboardCheck },
];

const blankProfileFields = (p: OnboardingProfile): Partial<OnboardingProfile> => ({
  consent: { saveAnswers: false, smsResume: false, shareWithEmployers: false, givenAt: new Date().toISOString() },
  name: { givenName: '', familyName: '' },
  contact: {},
  dateOfBirth: undefined,
  identity: undefined,
  support: undefined,
  progress: { currentStep: 0, totalSteps: p.progress.totalSteps, completedSteps: [] },
});

export const WizardShell: React.FC<WizardShellProps> = ({
  lang: langProp, theme = 'terracotta', mode = 'standalone', onDispatch, services = localServices, audioBaseUrl,
}) => {
  const profile = useOnboardingStore((s) => s.profile);
  const updateProfile = useOnboardingStore((s) => s.updateProfile);
  const setStoreStep = useOnboardingStore((s) => s.setStep);
  const setStoreLang = useOnboardingStore((s) => s.setLang);

  const rootRef = useRef<HTMLElement>(null);
  const idBase = `db-${cleanId(useId())}`;
  const headingId = `${idBase}-heading`;
  const { announcement, announce } = useAnnouncer();

  const lang: Lang = profile.lang;
  const t = useMemo(() => makeT(lang), [lang]);
  const step = Math.min(Math.max(profile.progress.currentStep, 0), TOTAL_STEPS - 1);

  const [simple, setSimple] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [summaryKey, setSummaryKey] = useState(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const editMode = mode === 'edit';
  // Offline (no network, or the API fell back to the on-device mock): say so in words, persistently.
  const storeOffline = useOnboardingStore((s) => s.isOffline);
  const [networkOffline, setNetworkOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [finished, setFinished] = useState(!editMode && !!profile.progress.completedAt);
  const [partnerDraft, setPartnerDraft] = useState<PartnerDraft>(() => partnerDraftFrom(profile));

  // `lang` attribute on the custom element wins on change (Dev 1 passes it through).
  useEffect(() => {
    if (langProp && langProp !== useOnboardingStore.getState().profile.lang) setStoreLang(langProp);
  }, [langProp, setStoreLang]);

  // Save & resume by SMS link: ?resume=DB-XXXXXX restores the saved answers once.
  const resumeHandled = useRef(false);
  useEffect(() => {
    if (resumeHandled.current || typeof location === 'undefined') return;
    resumeHandled.current = true;
    const code = new URLSearchParams(location.search).get('resume');
    if (!code) return;
    void services.restoreFromCode(code).then((result) => {
      const currentLang = useOnboardingStore.getState().profile.lang;
      if (result.ok) {
        const { id: _id, partnerId: _partnerId, ...restored } = result.profile;
        updateProfile({ ...restored, lang: currentLang });
        setPartnerDraft(partnerDraftFrom(result.profile));
        announce(translate(currentLang, 'sms.restored'));
      } else {
        announce(errorText(currentLang, result.code));
      }
    });
  }, [services, updateProfile, announce]);

  // mode="edit": land on the profile summary (Step 7) so every answer is one "Edit" away.
  useEffect(() => {
    if (editMode) {
      setStoreStep(TOTAL_STEPS - 1);
      setFinished(false);
    }
  }, [editMode, setStoreStep]);

  useEffect(() => {
    const goOffline = () => {
      setNetworkOffline(true);
      announce(translate(useOnboardingStore.getState().profile.lang, 'status.offlineSaved'));
    };
    const goOnline = () => {
      setNetworkOffline(false);
      announce(translate(useOnboardingStore.getState().profile.lang, 'status.backOnline'));
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [announce]);
  const offline = networkOffline || storeOffline;

  /** Becomes true after the first navigation, so remounted headings take focus but page load never does. */
  const interacted = useRef(false);

  const dispatch = useCallback(
    (name: string, detail: unknown) => emitEvent(onDispatch, rootRef.current, name, detail),
    [onDispatch],
  );

  const lastStepEvent = useRef(-1);
  useEffect(() => {
    if (lastStepEvent.current === step) return;
    lastStepEvent.current = step;
    const detail: SignupStepDetail = { step: step + 1, of: TOTAL_STEPS };
    dispatch(SIGNUP_EVENTS.step, detail);
  }, [step, dispatch]);

  const goToStep = useCallback(
    (next: number) => {
      interacted.current = true;
      setErrors({});
      setFinished(false);
      setStoreStep(Math.min(Math.max(next, 0), TOTAL_STEPS - 1));
    },
    [setStoreStep],
  );

  const switchLang = (next: Lang) => {
    setStoreLang(next);
    announce(translate(next, 'lang.changed'));
  };

  const toggleSimple = () => {
    setSimple((on) => {
      announce(t(on ? 'help.simpleOff' : 'help.simpleOn'));
      return !on;
    });
  };

  const errorFor = (field: string) => {
    const code = errors[field];
    return code ? errorText(lang, code) : undefined;
  };

  const errorItems: ErrorSummaryItem[] = Object.entries(errors).flatMap(([field, code]) =>
    code ? [{ targetId: fieldId(idBase, field), label: t(FIELD_LABELS[field] ?? 'field.route'), message: errorText(lang, code) }] : [],
  );

  const showErrors = (found: FieldErrors) => {
    setErrors(found);
    setSummaryKey((k) => k + 1);
  };

  const finish = () => {
    interacted.current = true;
    // Re-check every step; send the user to the first one that still needs an answer.
    for (let s = 0; s < TOTAL_STEPS - 1; s++) {
      const found = validateStep(s, profile, partnerDraft, getVoiceNotes());
      if (Object.keys(found).length > 0) {
        setStoreStep(s);
        showErrors(found);
        return;
      }
    }
    const completedAt = new Date().toISOString();
    updateProfile({
      progress: { ...profile.progress, currentStep: step, completedSteps: STEP_IDS.map((_, i) => i), completedAt },
    });
    setFinished(true);
    announce(t(editMode ? 'edit.savedTitle' : 'review.finishedTitle'));
    // Support data travels only if the learner explicitly chose to share it with their learning provider.
    dispatch(DB_EVENTS.completed, {
      profileId: profile.id,
      partnerId: profile.partnerId,
      lang,
      completedAt,
      ...(profile.support?.tellLearningProvider ? { support: profile.support } : {}),
    });

    // Technical Guide v2 contract. `done` never carries support choices.
    const done: SignupDoneDetail = {
      profile: {
        name: [profile.name.givenName, profile.name.familyName].map((n) => n.trim()).filter(Boolean).join(' '),
        phone: profile.contact.phone,
        language: lang,
        idRoute: profile.identity?.route,
      },
      voiceNotes: profileVoiceNotes(),
    };
    dispatch(SIGNUP_EVENTS.done, done);
    // Separate on purpose, and only when the learner chose to share specific needs.
    const support = profile.support;
    if (support?.tellLearningProvider && !support.preferNotToSay && support.needs.length > 0) {
      const detail: SignupSupportDetail = {
        support: support.needs,
        ...(support.needs.includes('other') && support.otherText ? { otherText: support.otherText } : {}),
      };
      dispatch(SIGNUP_EVENTS.support, detail);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    interacted.current = true;
    if (step === TOTAL_STEPS - 1) {
      finish();
      return;
    }
    const found = validateStep(step, profile, partnerDraft, getVoiceNotes());
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }
    const normalised = normaliseStep(step, profile, partnerDraft);
    if (normalised) updateProfile(normalised);
    setErrors({});
    setStoreStep(editMode ? TOTAL_STEPS - 1 : step + 1);
    announce(t('wizard.saved'));
    dispatch(DB_EVENTS.stepSaved, { profileId: profile.id, step, stepId: STEP_IDS[step] }); // no answers in the event
  };

  const deleteAll = async () => {
    await services.deleteAllData(profile.id);
    clearVoiceNotes();
    updateProfile(blankProfileFields(profile));
    setPartnerDraft({ partnerId: '', agentId: '', consent: false });
    setErrors({});
    setFinished(false);
  };

  const def = STEPS[step];
  const StepComponent = def.Component;
  const title = t(def.titleKey);
  const hint = t(simple ? def.simpleHintKey : def.hintKey);
  const onSummary = step === TOTAL_STEPS - 1;
  const finishedTitle = t(editMode ? 'edit.savedTitle' : 'review.finishedTitle');
  const finishedBody = t(editMode ? 'edit.savedBody' : 'review.finishedBody');
  const headingText = finished
    ? finishedTitle
    : editMode && onSummary
      ? t('edit.title')
      : t('wizard.stepHeading', { current: step + 1, total: TOTAL_STEPS, title });
  const shownHint = editMode && onSummary ? t('edit.hint') : hint;
  const readText = finished ? `${finishedTitle}. ${finishedBody}` : `${headingText}. ${shownHint}${step === 0 ? ` ${t('banner.intro')}` : ''}`;
  const submitLabel = onSummary ? t(editMode ? 'edit.save' : 'wizard.finish') : t(editMode ? 'edit.saveReturn' : 'wizard.next');

  const stepProps: StepProps = {
    lang, t, simple, idBase, profile, update: updateProfile, errors, errorFor, announce, services,
    openPrivacy: () => setPrivacyOpen(true), goToStep, partnerDraft, setPartnerDraft, editMode,
  };

  const highContrast = theme === 'high-contrast';

  return (
    <section
      ref={rootRef}
      lang={lang}
      aria-label={t('app.name')}
      data-theme={theme}
      className={cx(
        'w-full max-w-[48rem] mx-auto p-4 sm:p-8 rounded-2xl font-sans text-base leading-relaxed break-words',
        scriptClass(lang),
        highContrast ? 'bg-white text-black border-2 border-black' : 'bg-parchment text-ink border border-sand shadow-card',
      )}
    >
      <style>{ETHIOPIC_CSS}</style>
      <LiveRegion announcement={announcement} />

      <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-terracotta-dark">
        <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-terracotta" />
        {t('app.name')}
      </p>
      {mode === 'partner-assisted' && (
        <p className={ui.notice}>
          <Users aria-hidden="true" focusable="false" className="h-6 w-6 shrink-0 text-terracotta" />
          <span>{t('banner.partnerAssisted')}</span>
        </p>
      )}

      {offline && (
        <p className={ui.notice}>
          <WifiOff aria-hidden="true" focusable="false" className="h-6 w-6 shrink-0 text-terracotta" />
          <span>{t('status.offlineSaved')}</span>
        </p>
      )}

      <ProgressBar currentStep={finished ? TOTAL_STEPS - 1 : step} totalSteps={TOTAL_STEPS} t={t} />

      <VoiceControl lang={lang} rootRef={rootRef} announce={announce} />

      <HelpCluster
        lang={lang}
        readText={readText}
        promptKey={finished ? 'finished' : `step${step}`}
        simple={simple}
        onToggleSimple={toggleSimple}
        onSwitchLang={switchLang}
        onOpenPrivacy={() => setPrivacyOpen(true)}
        announce={announce}
        audioBaseUrl={audioBaseUrl}
      />

      {finished ? (
        <div>
          <StepHeading id={headingId} focusKey="finished" focusOnMount={interacted.current} allowFocus={interacted.current}>
            <span className="flex items-center gap-2">
              <CheckCircle2 aria-hidden="true" focusable="false" className="h-7 w-7 shrink-0 text-green-800" />
              {headingText}
            </span>
          </StepHeading>
          <p className="mb-6">{finishedBody}</p>
          <button type="button" onClick={() => goToStep(TOTAL_STEPS - 1)} className={ui.btnSecondary}>
            <ArrowLeft aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
            {t(editMode ? 'edit.title' : 'step6.title')}
          </button>
        </div>
      ) : (
        <form noValidate onSubmit={onSubmit} aria-labelledby={headingId}>
          <StepHeading id={headingId} focusKey={step} skipFocus={errorItems.length > 0} focusOnMount={interacted.current} allowFocus={interacted.current}>
            {headingText}
          </StepHeading>

          {/* Directly under the step <h2> so its <h3> keeps heading order; it takes focus on failed submit. */}
          <ErrorSummary items={errorItems} focusKey={summaryKey} t={t} />

          {step === 0 && <p className="mb-3 font-semibold">{t('banner.intro')}</p>}
          <p className="mb-6 flex items-start gap-3">
            {simple && <def.Icon aria-hidden="true" focusable="false" className="h-8 w-8 shrink-0 text-terracotta" />}
            <span>{shownHint}</span>
          </p>

          <StepComponent {...stepProps} />

          <div className="mt-8 flex flex-wrap gap-3 border-t border-sand pt-5">
            {step > 0 && (
              <button type="button" onClick={() => goToStep(step - 1)} className={ui.btnSecondary} data-db-action="back">
                <ArrowLeft aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
                {t('wizard.back')}
              </button>
            )}
            <button type="submit" className={ui.btnPrimary}>
              {submitLabel}
              {onSummary || editMode ? (
                <CheckCircle2 aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              ) : (
                <ArrowRight aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0" />
              )}
            </button>
          </div>
        </form>
      )}

      <PrivacyDrawer
        lang={lang}
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        profile={profile}
        onDelete={deleteAll}
        announce={announce}
      />
    </section>
  );
};
