import React from 'react';
import { ReactShadowElement } from '../base/ReactShadowElement';
import { AskPanel } from '../ask/AskPanel';

/** <db-ask>: bilingual "Ask a question" help. Same answers as POST /api/v1/help/ask, but works offline. */
export class DbAskElement extends ReactShadowElement {
  static version = '1.0.0';

  protected renderWidget(): void {
    this.render(<AskPanel lang={this.currentLang} audioBaseUrl={this.audioBaseUrl} />);
  }

  protected async prepareRuntime(): Promise<void> {
    await Promise.resolve();
  }
}
