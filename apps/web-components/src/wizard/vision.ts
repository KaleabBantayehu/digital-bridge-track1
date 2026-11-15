import { useSyncExternalStore } from 'react';

/**
 * Colour / vision mode (co-designer finding: "colour-blind people can't tell buttons apart when all colours have the
 * same shade"). One choice for every widget on the page, remembered on this device. The host can also set it with
 * the `vision` attribute on any widget. Each mode keeps the same shapes and borders; only the palette changes.
 */
export type VisionMode = 'terracotta' | 'colorblind-safe' | 'high-contrast' | 'dark';
export const VISION_MODES: VisionMode[] = ['terracotta', 'colorblind-safe', 'high-contrast', 'dark'];
export const VISION_LABEL_KEYS: Record<VisionMode, string> = {
  terracotta: 'vision.terracotta',
  'colorblind-safe': 'vision.colorblind',
  'high-contrast': 'vision.high',
  dark: 'vision.dark',
};

const STORAGE_KEY = 'db-vision-mode';
const listeners = new Set<() => void>();

export const isVisionMode = (value: unknown): value is VisionMode => VISION_MODES.includes(value as VisionMode);

function readStored(): VisionMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isVisionMode(value) ? value : 'terracotta';
  } catch {
    return 'terracotta';
  }
}

let current: VisionMode | null = null;

export function getVisionMode(): VisionMode {
  current ??= readStored();
  return current;
}

export function setVisionMode(mode: VisionMode): void {
  if (!isVisionMode(mode) || mode === getVisionMode()) return;
  current = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage blocked: the choice still applies until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
  // Lets the host page keep its own colour switch in step (a UI preference, never personal data).
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('db-vision-mode', { detail: { mode } }));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useVisionMode = (): VisionMode => useSyncExternalStore(subscribe, getVisionMode, () => 'terracotta');
