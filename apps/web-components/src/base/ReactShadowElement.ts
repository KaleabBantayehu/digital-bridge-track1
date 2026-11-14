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
    return ['api', 'api-url', 'partner-id', 'lang', 'theme', 'mode', 'lti-token', 'session-id', 'audio-base-url'];
  }

  private reactRoot?: Root;
  private mountPoint?: HTMLDivElement;

  connectedCallback(): void {
    loadDocumentFonts();
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

  /** Base URL that holds audio/am/manifest.json with recorded Amharic prompts (optional). */
  protected get audioBaseUrl(): string | undefined {
    return this.getAttribute('audio-base-url') || undefined;
  }

  protected get theme(): 'terracotta' | 'high-contrast' {
    return this.getAttribute('theme') === 'high-contrast' ? 'high-contrast' : 'terracotta';
  }

  protected dispatchHostEvent(name: string, detail: unknown, profile?: OnboardingProfile): void {
    // Guide v2 events are created once, by WizardShell (SIGNUP_EVENTS). Here they only get a privacy guard:
    // 'db-signup:support' never leaves the widget unless the learner chose to share support with their provider,
    // and 'db-signup:done' never carries support data.
    if (name === 'db-signup:support' && profile?.support?.tellLearningProvider !== true) return;
    if (name === 'db-signup:done') {
      this.dispatchEvent(new CustomEvent(name, { detail: redactPrivateSupportData(detail), bubbles: true, composed: true }));
      return;
    }
    const safeDetail =
      hasSupportSharingConsent(detail) || profile?.support?.tellLearningProvider === true
        ? detail
        : redactPrivateSupportData(detail);
    this.dispatchEvent(new CustomEvent(name, { detail: safeDetail, bubbles: true, composed: true }));
  }

  protected render(node: ReactNode): void {
    this.reactRoot?.render(node);
  }

  protected abstract renderWidget(): void;
  protected abstract prepareRuntime(): Promise<void>;
}

let fontsRequested = false;

/** Fonts are document-scoped, so load them once into document.head (CLAUDE.md §2.7), with system fallbacks. */
function loadDocumentFonts(): void {
  if (fontsRequested || typeof document === 'undefined') return;
  fontsRequested = true;
  if (document.querySelector('link[data-db-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;600;700&display=swap';
  link.dataset.dbFonts = '';
  document.head.append(link);
}
