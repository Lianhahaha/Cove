import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { usedToday } from './ai';

// Manila is UTC+8, so just after midnight there it is still yesterday in UTC.
const originalTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
beforeAll(() => {
  process.env.TZ = 'Asia/Manila';
});
afterAll(() => {
  process.env.TZ = originalTz;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('resets the daily AI limit at local midnight', () => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 29, 0, 30));

  store.set('cove-ai-usage', JSON.stringify({ date: '2026-09-28', count: 40 }));
  expect(usedToday()).toBe(0);
  store.set('cove-ai-usage', JSON.stringify({ date: '2026-09-29', count: 3 }));
  expect(usedToday()).toBe(3);
});
