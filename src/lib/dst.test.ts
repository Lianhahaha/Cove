import 'fake-indexeddb/auto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from './db';
import { nextOccurrence, setDone } from './actions';
import { dueBucket } from './dates';
import { toIcs } from './ics';
import { parseQuickAdd } from './parse';
import { addItem, newItem } from './repo';

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

  it('writes a repeating timed task in local time, so it stays at 9am after the change', () => {
    const due = new Date(2026, 9, 5, 9).getTime();
    const ics = toIcs([newItem({ id: 'w', title: 'Lab', due, dueHasTime: true, status: 'todo', recurrence: { freq: 'weekly', interval: 1 } })]);
    expect(ics).toContain('DTSTART:20261005T090000\r\n');
    expect(ics).toContain('DTEND:20261005T093000\r\n');
  });
});

describe('nextOccurrence across a clock change', () => {
  it('goes back to the usual time after a day with no 2:30', () => {
    // Mar 14, 2027 has no 2:30am, so that day's repeat is at 3:30; the next one is 2:30 again.
    const due = new Date(2027, 2, 13, 2, 30).getTime();
    expect(nextOccurrence(due, { freq: 'daily', interval: 1 }, new Date(2027, 2, 14, 10).getTime())).toBe(new Date(2027, 2, 15, 2, 30).getTime());
  });

  it('keeps the series at 2:30 when each repeat is finished in turn', async () => {
    // These dates are still ahead, so each repeat is simply the next day's.
    const first = await addItem({ status: 'todo', due: new Date(2027, 2, 13, 2, 30).getTime(), dueHasTime: true, recurrence: { freq: 'daily', interval: 1 } });
    await setDone(first, true);
    const second = (await db.items.get((await db.items.get(first.id))!.nextId!))!;
    expect(new Date(second.due!).getHours()).toBe(3); // Mar 14 has no 2:30.
    await setDone(second, true);
    const third = (await db.items.get((await db.items.get(second.id))!.nextId!))!;
    expect(third.due).toBe(new Date(2027, 2, 15, 2, 30).getTime());
  });
});

describe('parseQuickAdd across a clock change', () => {
  it('keeps the typed hour when a passed time rolls over to tomorrow', () => {
    const p = parseQuickAdd('call the lab 5pm', { now: new Date(2026, 9, 31, 20) });
    expect(p.due).toBe(new Date(2026, 10, 1, 17).getTime());
  });
});
