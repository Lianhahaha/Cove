import { effect, signal } from '@preact/signals';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'cove-theme';

export type PaletteName = 'lavender' | 'sage' | 'sky' | 'rose';
const PALETTE_KEY = 'cove-palette';

/** `swatch` is the palette's light-mode accent (--l-accent in styles.css), shown in Settings. */
export const PALETTES: { value: PaletteName; label: string; swatch: string }[] = [
  { value: 'lavender', label: 'Lavender', swatch: '#684c96' },
  { value: 'sage', label: 'Sage', swatch: '#3e6947' },
  { value: 'sky', label: 'Sky', swatch: '#326289' },
  { value: 'rose', label: 'Rose', swatch: '#854665' },
];

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function readPalette(): PaletteName {
  try {
    const v = localStorage.getItem(PALETTE_KEY);
    return PALETTES.some((p) => p.value === v) ? (v as PaletteName) : 'lavender';
  } catch {
    return 'lavender';
  }
}

export const themePref = signal<ThemePref>(read());
export const palettePref = signal<PaletteName>(readPalette());

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
export const systemDark = signal(media?.matches ?? false);
media?.addEventListener('change', (e) => (systemDark.value = e.matches));

export const isDark = () => (themePref.value === 'system' ? systemDark.value : themePref.value === 'dark');

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts for this session only */
  }
}

// Saved only when the choice itself changes, so an OS theme switch can't write back a stale value.
effect(() => store(KEY, themePref.value === 'system' ? null : themePref.value));
effect(() => store(PALETTE_KEY, palettePref.value === 'lavender' ? null : palettePref.value));

// A choice made in another tab applies here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) themePref.value = read();
    if (e.key === PALETTE_KEY) palettePref.value = readPalette();
  });
}

effect(() => {
  const pref = themePref.value;
  const palette = palettePref.value;
  void systemDark.value; // re-run when the OS switches, so the browser bar follows
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  if (palette === 'lavender') delete root.dataset.palette;
  else root.dataset.palette = palette;
  // One theme-color tag that tracks the page background, so the browser bar matches.
  // Read on the next frame, once the stylesheet has applied the new palette.
  requestAnimationFrame(() => {
    const bg = getComputedStyle(root).getPropertyValue('--c-bg').trim();
    if (!bg) return;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.removeAttribute('media');
      m.setAttribute('content', bg);
    });
  });
});
