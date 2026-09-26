import { signal } from '@preact/signals';

/** The capture sheet: open state plus optional prefilled text or files. */
export const capture = signal<{ open: boolean; text?: string; spaceId?: string | null; files?: File[] }>({ open: false });
export const openCapture = (init: Omit<typeof capture.value, 'open'> = {}) => (capture.value = { open: true, ...init });
export const closeCapture = () => (capture.value = { open: false });

/** Mobile navigation drawer. */
export const menuOpen = signal(false);

/** Command palette. */
export const paletteOpen = signal(false);
