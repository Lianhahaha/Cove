import { effect, signal } from '@preact/signals';

export type FontSizePref = 'default' | 'compact' | 'large';
const FONT_KEY = 'cove-fontsize';
const MOTION_KEY = 'cove-motion';

function readFontSize(): FontSizePref {
  try {
    const v = localStorage.getItem(FONT_KEY);
    return v === 'compact' || v === 'large' ? v : 'default';
  } catch {
    return 'default';
  }
}

function readMotion(): boolean {
  try {
    return localStorage.getItem(MOTION_KEY) === '1';
  } catch {
    return false;
  }
}

export const fontSizePref = signal<FontSizePref>(readFontSize());
export const reduceMotion = signal<boolean>(readMotion());

const store = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts for this session only */
  }
};

// Saved only when the choice itself changes, so a later load writes nothing back.
effect(() => {
  const size = fontSizePref.value;
  const motion = reduceMotion.value;
  void motion;
  store(FONT_KEY, size === 'default' ? null : size);
  store(MOTION_KEY, motion ? '1' : null);
});

// A choice made in another tab applies here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === FONT_KEY) fontSizePref.value = readFontSize();
    if (e.key === MOTION_KEY) reduceMotion.value = readMotion();
  });
}

effect(() => {
  const size = fontSizePref.value;
  const motion = reduceMotion.value;
  const root = document.documentElement;
  if (size === 'default') delete root.dataset.fontsize;
  else root.dataset.fontsize = size;
  if (motion) root.dataset.motion = 'reduce';
  else delete root.dataset.motion;
});
