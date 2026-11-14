import React from 'react';
import { ReactShadowElement } from '../base/ReactShadowElement';
import { CareerGateway } from '../career/CareerGateway';

export class DbCareerGatewayElement extends ReactShadowElement {
  static version = '1.0.0';
  protected renderWidget(): void {
    this.render(
      <CareerGateway
        apiUrl={this.apiUrl}
        partnerId={this.partnerId}
        lang={this.currentLang}
        theme={this.theme}
        onDispatch={(name, detail) => this.dispatchHostEvent(name, detail)}
      />,
    );
  }

  protected async prepareRuntime(): Promise<void> {
    await Promise.resolve();
  }
}
