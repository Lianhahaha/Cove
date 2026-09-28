import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dueBucket } from './dates';
import { toIcs } from './ics';
import { newItem } from './repo';

// These run in a time zone with daylight saving, where some days are 23 or 25 hours long.
// In the US, clocks go back on Nov 1, 2026 and forward on Mar 14, 2027.
const originalTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
beforeAll(() => {
  process.env.TZ = 'America/New_York';
});
afterAll(() => {
  process.env.TZ = originalTz;
});

describe('dueBucket across a clock change', () => {
  it('keeps a late-evening task in today on a 25-hour day', () => {
    const now = new Date(2026, 10, 1, 9);
    expect(dueBucket(new Date(2026, 10, 1, 23, 30).getTime(), true, now)).toBe('today');
    expect(dueBucket(new Date(2026, 10, 2).getTime(), false, now)).toBe('tomorrow');
  });

  it('puts tomorrow’s date in tomorrow on a 23-hour day', () => {
    const now = new Date(2027, 2, 14, 9);
    expect(dueBucket(new Date(2027, 2, 15).getTime(), false, now)).toBe('tomorrow');
    expect(dueBucket(new Date(2027, 2, 16).getTime(), false, now)).toBe('week');
  });
});

describe('toIcs across a clock change', () => {
  it('ends an all-day event on the next date, even on a 25-hour day', () => {
    const due = new Date(2026, 10, 1).getTime();
    const ics = toIcs([newItem({ id: 'd', title: 'Essay', due, status: 'todo' })]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261101');
    expect(ics).toContain('DTEND;VALUE=DATE:20261102');
  });
});
