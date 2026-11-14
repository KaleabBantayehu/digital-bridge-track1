import React from 'react';
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

  disconnectedCallback(): void {
    this.restoreEditModeProgress();
    super.disconnectedCallback();
  }

  protected renderWidget(): void {
    this.ensureApiServices();
    const store = useOnboardingStore.getState();
    if (store.profile.lang !== this.currentLang) store.setLang(this.currentLang);
    const requestedMode = this.getAttribute('mode');
    const mode =
      requestedMode === 'lti' || requestedMode === 'partner-assisted' || requestedMode === 'edit' ? requestedMode : 'standalone';
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
        audioBaseUrl={this.audioBaseUrl}
        // WizardShell emits each event once: DB_EVENTS plus the Guide v2 'db-signup:step' {step, of},
        // 'db-signup:done' and consent-gated 'db-signup:support'. This element only adds the privacy guard.
        onDispatch={(name, detail) => this.dispatchHostEvent(name, detail, useOnboardingStore.getState().profile)}
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
      // mode="edit" opens on the profile summary ("Edit my profile"), where every answer is one "Edit" away.
      const currentStep = profile.progress.totalSteps - 1;
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
