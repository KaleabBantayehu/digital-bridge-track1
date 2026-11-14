import { DbCareerGatewayElement } from './elements/DbCareerGatewayElement';
import { DbEmployerAccommodationsElement } from './elements/DbEmployerAccommodationsElement';
import { DbOnboardingWizardElement } from './elements/DbOnboardingWizardElement';
import { DbSignupElement } from './elements/DbSignupElement';

if (!customElements.get('db-onboarding-wizard')) {
  customElements.define('db-onboarding-wizard', DbOnboardingWizardElement);
}

if (!customElements.get('db-signup')) {
  customElements.define('db-signup', DbSignupElement);
}

if (!customElements.get('db-career-gateway')) {
  customElements.define('db-career-gateway', DbCareerGatewayElement);
}

if (!customElements.get('db-employer-accommodations')) {
  customElements.define('db-employer-accommodations', DbEmployerAccommodationsElement);
}

function autoMountWidgets(): void {
  const script = Array.from(document.scripts).find((candidate) =>
    ['true', 'onboarding', 'career', 'both'].includes(candidate.dataset.autoMount ?? ''),
  );
  if (!script || !document.body) return;

  const mode = script.dataset.autoMount === 'true' ? 'onboarding' : script.dataset.autoMount;
  const tags =
    mode === 'both'
      ? ['db-onboarding-wizard', 'db-career-gateway']
      : mode === 'career'
        ? ['db-career-gateway']
        : ['db-onboarding-wizard'];

  for (const tagName of tags) {
    if (document.querySelector(tagName)) continue;
    const widget = document.createElement(tagName);
    const attributes = {
      'partner-id': script.dataset.partnerId,
      lang: script.dataset.lang,
      theme: script.dataset.theme,
      'api-url': script.dataset.apiUrl,
    };
    for (const [name, value] of Object.entries(attributes)) {
      if (value) widget.setAttribute(name, value);
    }
    document.body.append(widget);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoMountWidgets, { once: true });
} else {
  autoMountWidgets();
}

export { DbCareerGatewayElement, DbEmployerAccommodationsElement, DbOnboardingWizardElement };
