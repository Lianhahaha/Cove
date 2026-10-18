import { effect, signal } from '@preact/signals';

/** 0 is Sunday, 1 is Monday. The calendar's first column. */
export type WeekStart = 0 | 1;
const KEY = 'cove-weekstart';

function read(): WeekStart {
  try {
    return localStorage.getItem(KEY) === '1' ? 1 : 0;
  } catch {
    return 0;
  }
}

export const weekStart = signal<WeekStart>(read());

const store = (value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
  } catch {
    /* storage unavailable: the choice lasts for this session only */
  }
};

// Saved only when the choice itself changes, so a later load writes nothing back.
effect(() => store(weekStart.value === 1 ? '1' : null));

// A choice made in another tab applies here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) weekStart.value = read();
  });
}

/**
 * The six weeks (42 days) of the month's calendar grid, starting on the week's
 * first day on or before the 1st. Pure, so it can be tested without a browser.
 */
export function monthGrid(month: Date, start: WeekStart): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), month.getDate() - ((month.getDay() - start + 7) % 7));
  return Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
}
