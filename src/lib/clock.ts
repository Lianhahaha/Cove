import { signal } from '@preact/signals';

const currentMinute = () => Math.floor(Date.now() / 60_000);

/**
 * The current minute. Lists grouped by due time read it, so they regroup as
 * time passes with no edit to trigger them: a 3pm task turns overdue at 3pm,
 * and tomorrow's tasks move up to Today at midnight.
 */
export const minute = signal(currentMinute());

if (typeof window !== 'undefined') {
  setInterval(() => {
    const m = currentMinute();
    if (m !== minute.value) minute.value = m;
  }, 15_000);
}
