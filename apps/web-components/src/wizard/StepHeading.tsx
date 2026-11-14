import React, { useEffect, useRef } from 'react';
import { cx } from './ui';

export interface StepHeadingProps {
  id: string;
  /** Changes whenever the step changes; focus moves to the heading (WCAG 2.4.3, 2.4.6). */
  focusKey: string | number;
  children: React.ReactNode;
  className?: string;
  /** True when an Error Summary is showing: it gets focus instead of the heading. */
  skipFocus?: boolean;
  /** Focus on mount too (used when the view swaps after a user action, never on page load). */
  focusOnMount?: boolean;
}

/** The single <h2> per step. Programmatically focusable, never focused on first page load. */
export const StepHeading: React.FC<StepHeadingProps> = ({ id, focusKey, children, className, skipFocus, focusOnMount }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      if (focusOnMount && !skipFocus) headingRef.current?.focus();
      return;
    }
    if (!skipFocus) headingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  return (
    <h2 id={id} ref={headingRef} tabIndex={-1} className={cx('text-2xl font-bold mb-2 scroll-my-24 focus:outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-terracotta', className)}>
      {children}
    </h2>
  );
};
