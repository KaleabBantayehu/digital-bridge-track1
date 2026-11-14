import React from 'react';
import { ReactShadowElement } from '../base/ReactShadowElement';
import { ApiClient } from '../api/ApiClient';
import { setPersistenceScope, useOnboardingStore } from '../state/store';
import { startSyncQueue } from '../state/syncQueue';
import { WizardShell } from '../wizard/WizardShell';

export class DbOnboardingWizardElement extends ReactShadowElement {
  static version = '1.0.0';
  private runtimeKey = '';

  protected renderWidget(): void {
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
      />,
    );
  }

  protected async prepareRuntime(): Promise<void> {
    const sessionId = this.getAttribute('session-id') || 'local-session-1';
    const scope = `${this.apiUrl ?? ''}:${this.partnerId}:${sessionId}`;
    if (this.runtimeKey === scope) return;
    await setPersistenceScope(this.partnerId, sessionId);
    useOnboardingStore.getState().setLang(this.currentLang);
    useOnboardingStore.setState({ isOffline: false });

    const client = new ApiClient({
      apiUrl: this.apiUrl,
      partnerId: this.partnerId,
      onFallback: () => {
        useOnboardingStore.setState({
          isOffline: true,
          statusMessage:
            useOnboardingStore.getState().profile.lang === 'am'
              ? 'ከመስመር ውጭ እየሰሩ ነው – በዚህ መሣሪያ ላይ ተቀምጧል።'
              : 'Working offline – saved on this device.',
        });
      },
    });
    startSyncQueue(client);
    this.runtimeKey = scope;
  }
}
