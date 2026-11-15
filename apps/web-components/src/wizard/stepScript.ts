import type { Lang } from '@db/shared-schemas';
import { t as translate, type I18nKey } from '../i18n';
import { splitPhrases } from '../voice/speech';

/** One spoken phrase and (optionally) the control it describes, so the page can highlight it while it is read. */
export interface ScriptPhrase {
  text: string;
  el?: HTMLElement | null;
}

const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

/** Visible label text without hints, errors or badges. */
function labelOf(el: HTMLElement): string {
  const label = (el as HTMLInputElement).labels?.[0];
  if (label) {
    const copy = label.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('[id]').forEach((hint) => hint.remove());
    return clean(copy.textContent);
  }
  return clean(el.getAttribute('aria-label')) || clean(el.textContent);
}

/** The form controls of the current step (no help bar, no review boxes, no helper panels). */
export function stepControls(root: ParentNode): HTMLElement[] {
  const body = root.querySelector<HTMLElement>('form, [data-db-step-body]');
  if (!body) return [];
  return Array.from(
    body.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, button[type="submit"], [data-db-action="back"], [data-db-action="dob-speak"]',
    ),
  ).filter((el) => el.getClientRects().length > 0 && !el.closest('[data-db-aux], dialog'));
}

/**
 * Round-2 finding (blind learners): Read aloud must say the whole step, not just the title: the question, the hint,
 * then every field and choice with the number voice control shows next to it.
 */
export function buildStepScript(root: ParentNode, lang: Lang, intro: string): ScriptPhrase[] {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key as I18nKey, vars);
  const phrases: ScriptPhrase[] = splitPhrases(intro).map((text) => ({ text }));
  let numbered = false;
  for (const el of stepControls(root)) {
    const input = el as HTMLInputElement;
    const type =
      el instanceof HTMLSelectElement ? t('vc.list')
        : input.type === 'checkbox' ? `${t('vc.checkbox')}, ${t(input.checked ? 'vc.checked' : 'vc.unchecked')}`
          : input.type === 'radio' ? `${t('vc.radio')}, ${t(input.checked ? 'vc.checked' : 'vc.unchecked')}`
            : el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? t('vc.textbox')
              : t('vc.button');
    const badgeHolder = (input.labels?.[0] as HTMLElement | undefined) ?? el;
    const n = badgeHolder.getAttribute('data-vc-num');
    if (n) numbered = true;
    const label = labelOf(el);
    if (!label) continue;
    phrases.push({ text: n ? t('script.item', { n, label, type }) : t('script.field', { label, type }), el: badgeHolder });
  }
  if (numbered) phrases.push({ text: t('script.closing') });
  return phrases;
}
