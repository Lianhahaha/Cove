import { signal } from '@preact/signals';

export interface ConfirmRequest {
  title: string;
  body?: string;
  /** The action on the button, like "Delete" or "Delete for good". */
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}

/** The question on screen, shown by ConfirmHost. */
export const confirmRequest = signal<ConfirmRequest | null>(null);

/**
 * Asks before something destructive, so a slip of the finger can't delete anything.
 * Resolves true only when the user presses the confirm button.
 */
export function confirmAction(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  confirmRequest.value?.resolve(false);
  return new Promise((resolve) => (confirmRequest.value = { ...opts, resolve }));
}
