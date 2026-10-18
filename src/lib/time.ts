import { effect, signal } from '@preact/signals';

const KEY = 'cove-hour24';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Show times as 17:30 instead of 5:30 PM. Off means the device's own format. */
export const hour24 = signal<boolean>(read());

effect(() => {
  try {
    if (hour24.value) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the choice lasts for this session only */
  }
});

// A choice made in another tab applies here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) hour24.value = read();
  });
}
