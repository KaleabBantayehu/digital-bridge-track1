import React, { type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DB_EVENTS, type OnboardingProfile } from '@db/shared-schemas';
import styles from '../styles/index.css?inline';

const privateSupportKeys = /^(support|supportPreferences|accommodations|adjustmentRequest|filters|needs)$/i;

function hasSupportSharingConsent(value: unknown, visited = new WeakSet<object>()): boolean {
  if (typeof value !== 'object' || value === null || visited.has(value)) return false;
  visited.add(value);
  return Object.entries(value).some(([key, nested]) => {
    if (/^(shareConsent|shareWithEmployers|shareSupportWithEmployer)$/i.test(key) && nested === true) return true;
    return hasSupportSharingConsent(nested, visited);
  });
}

function redactPrivateSupportData(value: unknown, visited = new WeakMap<object, unknown>()): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const existing = visited.get(value);
  if (existing !== undefined) return existing;

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    visited.set(value, copy);
    value.forEach((item) => copy.push(redactPrivateSupportData(item, visited)));
    return copy;
  }

  const copy: Record<string, unknown> = {};
  visited.set(value, copy);
  for (const [key, nested] of Object.entries(value)) {
    copy[key] = privateSupportKeys.test(key) ? '[redacted]' : redactPrivateSupportData(nested, visited);
  }
  return copy;
}

export abstract class ReactShadowElement extends HTMLElement {
  static version = '1.0.0';
  static get observedAttributes(): string[] {
    return ['api', 'api-url', 'partner-id', 'lang', 'theme', 'mode', 'lti-token', 'session-id'];
  }

  private reactRoot?: Root;
  private mountPoint?: HTMLDivElement;

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = styles;
      this.mountPoint = document.createElement('div');
      this.mountPoint.setAttribute('part', 'root');
      shadow.append(style, this.mountPoint);
    } else {
      this.mountPoint = this.shadowRoot.querySelector<HTMLDivElement>('[part="root"]') ?? undefined;
    }

    if (!this.mountPoint) {
      throw new Error('The widget shadow root is missing its mount point.');
    }

    this.mountPoint.lang = this.currentLang;
    this.reactRoot ??= createRoot(this.mountPoint);
    this.renderWidget();
    void this.prepareRuntime();
  }

  attributeChangedCallback(): void {
    if (this.mountPoint && this.reactRoot) {
      this.mountPoint.lang = this.currentLang;
      this.renderWidget();
      void this.prepareRuntime();
    }
  }

  disconnectedCallback(): void {
    this.reactRoot?.unmount();
    this.reactRoot = undefined;
    this.mountPoint = undefined;
  }

  protected get currentLang(): 'en' | 'am' {
    return this.getAttribute('lang') === 'am' ? 'am' : 'en';
  }

  protected get apiUrl(): string | undefined {
    return this.getAttribute('api') || this.getAttribute('api-url') || undefined;
  }

  protected get partnerId(): string {
    return this.getAttribute('partner-id') || 'alx-demo';
  }

  protected get theme(): 'terracotta' | 'high-contrast' {
    return this.getAttribute('theme') === 'high-contrast' ? 'high-contrast' : 'terracotta';
  }

  protected dispatchHostEvent(name: string, detail: unknown, profile?: OnboardingProfile): void {
    const safeDetail =
      hasSupportSharingConsent(detail) || profile?.support?.tellLearningProvider === true
        ? detail
        : redactPrivateSupportData(detail);
    this.dispatchEvent(new CustomEvent(name, { detail: safeDetail, bubbles: true, composed: true }));

    if (!this.supportsSignupEventAliases) return;

    if (name === DB_EVENTS.completed) {
      const sourceProfile = profile ?? (isRecord(detail) && isOnboardingProfile(detail.profile) ? detail.profile : undefined);
      if (sourceProfile) {
        const safeProfile = Object.fromEntries(
          Object.entries(sourceProfile).filter(([key]) => key !== 'support' && key !== 'voiceNotes'),
        );
        this.dispatchEvent(
          new CustomEvent('db-signup:done', {
            detail: {
              profile: safeProfile,
              voiceNotes: isRecord(detail) && Array.isArray(detail.voiceNotes) ? detail.voiceNotes : [],
            },
            bubbles: true,
            composed: true,
          }),
        );
      }
    }

    if (name === DB_EVENTS.supportRequested) {
      const support = isRecord(detail) && 'support' in detail ? detail.support : undefined;
      this.dispatchEvent(
        new CustomEvent('db-signup:support', {
          detail: {
            support:
              profile?.support?.tellLearningProvider === true
                ? support ?? profile.support
                : '[redacted]',
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  protected get supportsSignupEventAliases(): boolean {
    return false;
  }

  protected render(node: ReactNode): void {
    this.reactRoot?.render(node);
  }

  protected abstract renderWidget(): void;
  protected abstract prepareRuntime(): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOnboardingProfile(value: unknown): value is OnboardingProfile {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.partnerId === 'string' &&
    typeof value.lang === 'string' &&
    isRecord(value.progress)
  );
}
