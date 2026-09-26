import { effect, signal } from '@preact/signals';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'cove-theme';

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export const themePref = signal<ThemePref>(read());

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
export const systemDark = signal(media?.matches ?? false);
media?.addEventListener('change', (e) => (systemDark.value = e.matches));

export const isDark = () => (themePref.value === 'system' ? systemDark.value : themePref.value === 'dark');

effect(() => {
  const pref = themePref.value;
  const dark = pref === 'system' ? systemDark.value : pref === 'dark';
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  // One theme-color tag that tracks the active theme, so the browser bar matches.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.removeAttribute('media');
    m.setAttribute('content', dark ? '#191816' : '#fdfcf0');
  });
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage unavailable: the choice lasts for this session only */
  }
});
