/**
 * Fire a widget event. Dev 1's custom element passes `onDispatch` (which re-dispatches from the host);
 * otherwise we dispatch ourselves from inside the tree with bubbles + composed so it crosses the shadow boundary.
 * Payloads must never contain support/disability data unless the user consented.
 */
export function emitEvent(
  onDispatch: ((eventName: string, detail: unknown) => void) | undefined,
  origin: Element | null,
  name: string,
  detail: unknown,
): void {
  if (onDispatch) {
    onDispatch(name, detail);
    return;
  }
  origin?.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

/** Find an element by id inside the same shadow root (or document) as `from`. Never uses document.* directly. */
export function findInRoot(from: Element | null, id: string): HTMLElement | null {
  if (!from) return null;
  const root = from.getRootNode() as Document | ShadowRoot;
  return root.getElementById ? root.getElementById(id) : null;
}
