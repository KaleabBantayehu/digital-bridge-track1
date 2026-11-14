import React from 'react';
import { DB_EVENTS } from '@db/shared-schemas';
import { ApiBackedElement } from './ApiBackedElement';
import { setPersistenceScope, useOnboardingStore } from '../state/store';
import { startSyncQueue } from '../state/syncQueue';
import { WizardShell } from '../wizard/WizardShell';

export class DbOnboardingWizardElement extends ApiBackedElement {
  static version = '1.0.0';
  private runtimeKey = '';
  private editModeReady = false;
  private editModeInitialized = false;
  private editModeProgress?: { currentStep: number; completedAt?: string };
  private unsubscribeStore?: () => void;

  protected get supportsSignupEventAliases(): boolean {
    return true;
  }

  connectedCallback(): void {
    super.connectedCallback();
    let currentStep = useOnboardingStore.getState().profile.progress.currentStep;
    this.unsubscribeStore = useOnboardingStore.subscribe((state) => {
      const nextStep = state.profile.progress.currentStep;
      if (nextStep === currentStep) return;
      currentStep = nextStep;
      this.dispatchHostEvent('db-signup:step', { step: nextStep + 1, of: 7 });
    });
  }

  disconnectedCallback(): void {
    this.unsubscribeStore?.();
    this.unsubscribeStore = undefined;
    this.restoreEditModeProgress();
    super.disconnectedCallback();
  }

  protected renderWidget(): void {
    this.ensureApiServices();
    const store = useOnboardingStore.getState();
    if (store.profile.lang !== this.currentLang) store.setLang(this.currentLang);
    const requestedMode = this.getAttribute('mode');
    const mode = requestedMode === 'lti' || requestedMode === 'partner-assisted' ? requestedMode : 'standalone';
    this.render(
      <WizardShell
        key={`${requestedMode === 'edit' ? 'edit' : 'onboarding'}-${this.editModeReady}`}
        apiUrl={this.apiUrl}
        partnerId={this.partnerId}
        lang={this.currentLang}
        theme={this.theme}
        mode={mode}
        ltiToken={this.getAttribute('lti-token') ?? undefined}
        sessionId={this.getAttribute('session-id') ?? undefined}
        onDispatch={(name, detail) => {
          const profile = useOnboardingStore.getState().profile;
          this.dispatchHostEvent(name, detail, profile);
          if (name === DB_EVENTS.stepSaved && typeof detail === 'object' && detail !== null && 'stepId' in detail && detail.stepId === 'support') {
            this.dispatchHostEvent('db-signup:support', { support: profile.support }, profile);
          }
        }}
        services={this.services}
      />,
    );
  }

  protected async prepareRuntime(): Promise<void> {
    this.ensureApiServices();
    const sessionId = this.getAttribute('session-id') || 'local-session-1';
    const scope = `${this.apiUrl ?? ''}:${this.partnerId}:${sessionId}`;
    if (this.runtimeKey === scope) return;
    await setPersistenceScope(this.partnerId, sessionId);
    useOnboardingStore.getState().setLang(this.currentLang);
    if (this.getAttribute('mode') === 'edit' && !this.editModeInitialized) {
      const profile = useOnboardingStore.getState().profile;
      const currentStep = profile.progress.completedAt
        ? 1
        : Math.min(Math.max(profile.progress.currentStep, 1), 5);
      this.editModeProgress = {
        currentStep: profile.progress.currentStep,
        completedAt: profile.progress.completedAt,
      };
      useOnboardingStore.getState().updateProfile({
        progress: { ...profile.progress, currentStep, completedAt: undefined },
      });
      this.editModeInitialized = true;
      this.editModeReady = true;
      this.renderWidget();
    }
    if (this.getAttribute('mode') !== 'edit') this.restoreEditModeProgress();

    const client = this.client;
    if (!client) throw new Error('The onboarding widget ApiClient was not initialized.');
    if (!client.isOffline) useOnboardingStore.setState({ isOffline: false });
    startSyncQueue(client);
    this.runtimeKey = scope;
  }

  private restoreEditModeProgress(): void {
    if (!this.editModeProgress) return;
    const profile = useOnboardingStore.getState().profile;
    useOnboardingStore.getState().updateProfile({
      progress: {
        ...profile.progress,
        currentStep: this.editModeProgress.currentStep,
        completedAt: this.editModeProgress.completedAt,
      },
    });
    this.editModeProgress = undefined;
    this.editModeInitialized = false;
    this.editModeReady = false;
  }
}
