import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/**
 * Loads a component's code the first time `active` is true, then keeps it.
 * Keeps dialogs and panels out of the first download; the service worker
 * precaches every chunk, so this still works offline.
 */
export function useLazyComponent<P>(active: boolean, load: () => Promise<ComponentType<P>>): ComponentType<P> | null {
  const [Comp, setComp] = useState<ComponentType<P> | null>(null);
  useEffect(() => {
    if (active && !Comp) void load().then((c) => setComp(() => c));
  }, [active]);
  return Comp;
}
