import { I18N, type I18nKey, type Lang, type SupportFilter, ERROR_MESSAGES, type ErrorCode } from '@db/shared-schemas';

export type { I18nKey };
export type Vars = Record<string, string | number>;

/** Translate a key into the active language and fill {placeholders}. */
export function t(lang: Lang, key: I18nKey, vars?: Vars): string {
  const template = I18N[lang][key] ?? I18N.en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export type Translate = (key: I18nKey, vars?: Vars) => string;
export const makeT = (lang: Lang): Translate => (key, vars) => t(lang, key, vars);

export function errorText(lang: Lang, code: ErrorCode): string {
  return ERROR_MESSAGES[code][lang];
}

export function supportLabel(lang: Lang, filter: SupportFilter): string {
  return t(lang, `need.${filter}` as I18nKey);
}

export const otherLang = (lang: Lang): Lang => (lang === 'en' ? 'am' : 'en');
