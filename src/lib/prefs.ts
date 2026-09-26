import { useState } from 'preact/hooks';

/** A small per-device preference kept in localStorage, like a view's layout or sort. */
export function usePref<T extends string | number | boolean>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem('cove-pref:' + key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem('cove-pref:' + key, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  };
  return [value, set];
}
