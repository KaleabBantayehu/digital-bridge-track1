import React from 'react';
import { ApiBackedElement } from './ApiBackedElement';
import { setPersistenceScope, useOnboardingStore } from '../state/store';
import { startSyncQueue } from '../state/syncQueue';
import { WizardShell } from '../wizard/WizardShell';

export class DbOnboardingWizardElement extends ApiBackedElement {
  static version = '1.0.0';
  private runtimeKey = '';

  protected renderWidget(): void {
    this.ensureApiServices();
    const store = useOnboardingStore.getState();
    if (store.profile.lang !== this.currentLang) store.setLang(this.currentLang);
    const mode = this.getAttribute('mode');
    this.render(
      <WizardShell
        apiUrl={this.apiUrl}
        partnerId={this.partnerId}
        lang={this.currentLang}
        theme={this.theme}
        mode={mode === 'lti' || mode === 'partner-assisted' ? mode : 'standalone'}
        ltiToken={this.getAttribute('lti-token') ?? undefined}
        sessionId={this.getAttribute('session-id') ?? undefined}
        onDispatch={(name, detail) => this.dispatchHostEvent(name, detail)}
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

    const client = this.client;
    if (!client) throw new Error('The onboarding widget ApiClient was not initialized.');
    if (!client.isOffline) useOnboardingStore.setState({ isOffline: false });
    startSyncQueue(client);
    this.runtimeKey = scope;
  }
}
