import React from 'react';
import { ReactShadowElement } from '../base/ReactShadowElement';
import { AskPanel } from '../ask/AskPanel';
import { useOnboardingStore } from '../state/store';

/** <db-ask>: bilingual "Ask a question" help. Same answers as POST /api/v1/help/ask, but works offline. */
export class DbAskElement extends ReactShadowElement {
  static version = '1.0.0';
  private stopLangSync?: () => void;

  connectedCallback(): void {
    super.connectedCallback();
    // Follow the language button inside <db-signup> too (not only the host top bar), so the page stays in one
    // language. The sign-up widget changes the shared store; we mirror a change, never the store's starting value.
    this.stopLangSync ??= useOnboardingStore.subscribe((state, previous) => {
      const next = state.profile.lang;
      if (next !== previous.profile.lang && next !== this.currentLang) this.setAttribute('lang', next);
    });
  }

  disconnectedCallback(): void {
    this.stopLangSync?.();
    this.stopLangSync = undefined;
    super.disconnectedCallback();
  }

  protected renderWidget(): void {
    this.render(<AskPanel lang={this.currentLang} audioBaseUrl={this.audioBaseUrl} />);
  }

  protected async prepareRuntime(): Promise<void> {
    await Promise.resolve();
  }
}
