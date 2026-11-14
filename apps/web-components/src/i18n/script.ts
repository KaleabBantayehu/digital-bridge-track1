import type { Lang } from '@db/shared-schemas';

/**
 * Technical Guide v2 §9: Ethiopic script needs more line height (about 1.7), no letter spacing and no forced
 * capitals. Injected as a <style> inside each widget's shadow root and scoped to the root container class,
 * so it overrides Tailwind utilities such as `uppercase tracking-wide` / `leading-snug` on child elements.
 */
export const ETHIOPIC_CLASS = 'db-ethiopic';
export const ETHIOPIC_CSS = `.${ETHIOPIC_CLASS}, .${ETHIOPIC_CLASS} * { line-height: 1.7 !important; letter-spacing: normal !important; text-transform: none !important; } .${ETHIOPIC_CLASS} { font-family: 'Noto Sans Ethiopic', 'Nyala', var(--db-font), sans-serif; }`;

/** Root class for the active language ('' for English). */
export const scriptClass = (lang: Lang) => (lang === 'am' ? ETHIOPIC_CLASS : '');
