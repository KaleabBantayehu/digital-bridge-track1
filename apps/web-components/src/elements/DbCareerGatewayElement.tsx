import React from 'react';
import { ApiBackedElement } from './ApiBackedElement';
import { CareerGateway } from '../career/CareerGateway';

export class DbCareerGatewayElement extends ApiBackedElement {
  static version = '1.0.0';
  protected renderWidget(): void {
    this.ensureApiServices();
    this.render(
      <CareerGateway
        apiUrl={this.apiUrl}
        partnerId={this.partnerId}
        lang={this.currentLang}
        theme={this.theme}
        onDispatch={(name, detail) => this.dispatchHostEvent(name, detail)}
        services={this.services}
      />,
    );
  }

  protected async prepareRuntime(): Promise<void> {
    this.ensureApiServices();
    await Promise.resolve();
  }
}
