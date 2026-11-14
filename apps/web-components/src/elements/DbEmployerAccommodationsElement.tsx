import React from 'react';
import { ApiBackedElement } from './ApiBackedElement';
import { EmployerForm } from '../career/EmployerForm';

export class DbEmployerAccommodationsElement extends ApiBackedElement {
  static version = '1.0.0';
  protected renderWidget(): void {
    this.ensureApiServices();
    this.render(
      <EmployerForm lang={this.currentLang} services={this.services} />,
    );
  }

  protected async prepareRuntime(): Promise<void> {
    this.ensureApiServices();
    await Promise.resolve();
  }
}
