// apps/web-components/src/index.ts
import styles from './styles/index.css?inline';

export class DbOnboardingWizard extends HTMLElement {
  static version = '1.0.0';
  connectedCallback() {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>${styles}</style><div lang="en"><p>Digital Bridge Onboarding Ready</p></div>`;
    }
  }
}
if (!customElements.get('db-onboarding-wizard')) {
  customElements.define('db-onboarding-wizard', DbOnboardingWizard);
}