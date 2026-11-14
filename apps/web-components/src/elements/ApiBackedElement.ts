import { ApiClient } from '../api/ApiClient';
import { createDev2Services } from '../api/dev2Services';
import type { Dev2Services } from '../wizard/services';
import { useOnboardingStore } from '../state/store';
import { ReactShadowElement } from '../base/ReactShadowElement';

export abstract class ApiBackedElement extends ReactShadowElement {
  protected client?: ApiClient;
  protected services?: Dev2Services;
  private configKey = '';

  protected ensureApiServices(): void {
    const configKey = `${this.apiUrl ?? ''}\u0000${this.partnerId}`;
    if (this.configKey === configKey && this.client && this.services) return;

    const client = new ApiClient({
      apiUrl: this.apiUrl,
      partnerId: this.partnerId,
      onFallback: () => {
        useOnboardingStore.setState({
          isOffline: true,
          statusMessage:
            this.currentLang === 'am'
              ? 'ከመስመር ውጭ እየሰሩ ነው – በዚህ መሣሪያ ላይ ተቀምጧል።'
              : 'Working offline – saved on this device.',
        });
      },
    });
    this.client = client;
    this.services = createDev2Services(
      client,
      () => useOnboardingStore.getState().profile,
      () => useOnboardingStore.getState().deleteMyData(client),
    );
    this.configKey = configKey;
  }
}
