import React, { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import type { Translate } from '../i18n';
import { findInRoot } from './emit';

export interface ErrorSummaryItem {
  /** id of the invalid control (same shadow root). */
  targetId: string;
  label: string;
  message: string;
}

export interface ErrorSummaryProps {
  items: ErrorSummaryItem[];
  /** Bumped on every failed submit, so focus moves to the summary each time (WCAG 3.3.1). */
  focusKey: number;
  t: Translate;
}

/** Error Summary: role="alert", focused on failed submit, with jump links to each invalid field. */
export const ErrorSummary: React.FC<ErrorSummaryProps> = ({ items, focusKey, t }) => {
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (items.length > 0 && focusKey > 0) alertRef.current?.focus();
    // Only refocus on a new submit attempt, not while the list shrinks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  if (items.length === 0) return null;

  const jumpTo = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    // Hash navigation does not reach inside a shadow root, so focus the field ourselves.
    event.preventDefault();
    const target = findInRoot(alertRef.current, id);
    if (target) {
      target.focus();
      target.scrollIntoView({ block: 'center' });
    }
  };

  return (
    <div
      ref={alertRef}
      role="alert"
      tabIndex={-1}
      className="mb-6 rounded-md border-4 border-red-800 bg-white p-4 scroll-my-24 focus:outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-terracotta"
    >
      <h3 className="flex items-center gap-2 text-lg font-bold text-red-800">
        <AlertCircle aria-hidden="true" focusable="false" className="h-6 w-6 shrink-0" />
        {t('errors.summaryTitle')}
      </h3>
      <p className="mt-1 mb-2">{t('errors.summaryIntro')}</p>
      <ul className="list-disc pl-6 space-y-1">
        {items.map((item) => (
          <li key={item.targetId}>
            <a
              href={`#${item.targetId}`}
              onClick={(e) => jumpTo(e, item.targetId)}
              className="inline-block min-h-[44px] py-2 font-semibold text-red-800 underline underline-offset-2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-terracotta"
            >
              {item.label}: {item.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
