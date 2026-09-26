import { signal } from '@preact/signals';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
  action?: { label: string; run: () => void };
}

export const toasts = signal<Toast[]>([]);
let next = 1;

export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

export function toast(message: string, opts: { tone?: Toast['tone']; action?: Toast['action']; ms?: number } = {}) {
  const t: Toast = { id: next++, message, tone: opts.tone ?? 'info', action: opts.action };
  // Keep at most three on screen.
  toasts.value = [...toasts.value.slice(-2), t];
  setTimeout(() => dismissToast(t.id), opts.ms ?? (opts.action ? 6000 : 3500));
  return t.id;
}

export const toastError = (message: string) => toast(message, { tone: 'error', ms: 6000 });
