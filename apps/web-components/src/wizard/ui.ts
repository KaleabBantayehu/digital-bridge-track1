// Shared Tailwind class strings. Every interactive target is >= 44x44 CSS px (2.5.8), every focus ring is a 3px solid
// outline with a 2px offset (2.4.7, 2.4.13), and colour pairs meet 4.5:1 (see tailwind.config.js for the ratios).
export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

const focusable = 'scroll-my-24 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-terracotta-dark';
const btnBase = `inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl font-semibold text-base leading-snug text-start disabled:opacity-60 disabled:cursor-not-allowed ${focusable}`;

const secondaryColors = 'bg-white text-terracotta-dark border-2 border-terracotta hover:bg-terracotta-tint active:bg-sand-light';
// Pressed state uses its own colour set (never layered on secondaryColors: Tailwind's CSS order would let the
// dark text win and fail contrast).
const pressedColors = 'bg-ink text-white border-2 border-ink';

export const ui = {
  btnPrimary: `${btnBase} bg-terracotta text-white border-2 border-terracotta shadow-sm hover:bg-terracotta-dark hover:border-terracotta-dark active:bg-terracotta-darker`,
  btnSecondary: `${btnBase} ${secondaryColors}`,
  btnQuiet: `${btnBase} bg-transparent text-ink border-2 border-stone-500 hover:bg-white active:bg-sand-light`,
  /** Toggle button (use with aria-pressed). */
  btnToggle: (pressed: boolean) => `${btnBase} ${pressed ? pressedColors : secondaryColors}`,
  /** Rounded pill for the help cluster and other utility actions. */
  btnPill: `${btnBase} rounded-full px-4 ${secondaryColors}`,
  btnPillToggle: (pressed: boolean) => `${btnBase} rounded-full px-4 ${pressed ? pressedColors : secondaryColors}`,
  input: `block w-full max-w-[40rem] min-h-[44px] px-3 py-2 rounded-lg border-2 border-stone-600 bg-white text-ink text-base ${focusable}`,
  inputInvalid: 'border-red-800',
  label: 'block font-semibold text-base mb-1',
  hint: 'text-sm text-stone-700 mb-1',
  error: 'flex items-start gap-1 text-sm font-semibold text-red-800 mb-1',
  checkRow: 'flex items-start gap-3 min-h-[44px] py-2',
  checkbox: `mt-1 h-6 w-6 shrink-0 accent-terracotta ${focusable}`,
  fieldset: 'border border-sand rounded-xl bg-white/60 p-4 mb-4 min-w-0',
  legend: 'font-semibold text-base px-1',
  card: 'rounded-2xl border border-sand bg-white p-4 shadow-card',
  notice: 'flex items-start gap-2 rounded-xl border-2 border-terracotta bg-white p-3 mb-4',
  /** Quiet status badge (saved, offered, verified). Lagoon on light lagoon = 9.5:1. */
  badge: 'inline-flex items-center gap-1 rounded-full bg-lagoon-light text-lagoon border border-lagoon px-3 py-1 text-sm font-semibold',
  dialog: 'w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-auto rounded-2xl border-2 border-ink bg-parchment text-ink p-0 backdrop:bg-black/60',
  field: 'mb-5',
  srOnly: 'sr-only',
} as const;

/** React's useId() returns characters like ":" or "«" — strip them so ids work in CSS selectors and hrefs. */
export const cleanId = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, '');
