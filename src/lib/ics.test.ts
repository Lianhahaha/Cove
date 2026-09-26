import { describe, expect, it } from 'vitest';
import { foldLine, icsText, toIcs } from './ics';
import { newItem } from './repo';

describe('icsText', () => {
  it('escapes special characters', () => {
    expect(icsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });
});

describe('foldLine', () => {
  it('folds long lines at 75 octets without splitting characters', () => {
    const folded = foldLine('SUMMARY:' + 'é'.repeat(60));
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((l) => l.startsWith(' '))).toBe(true);
    expect(lines.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe('SUMMARY:' + 'é'.repeat(60));
  });
});

describe('toIcs', () => {
  const now = Date.UTC(2026, 8, 26, 0, 0, 0);

  it('writes a timed task with a one-hour alarm', () => {
    const due = Date.UTC(2026, 9, 2, 15, 59);
    const ics = toIcs([newItem({ id: 't1', title: 'Lab report, part 2', due, dueHasTime: true, status: 'todo' })], now);
    expect(ics).toContain('UID:t1@cove');
    expect(ics).toContain('DTSTART:20261002T155900Z');
    expect(ics).toContain('SUMMARY:Lab report\\, part 2');
    expect(ics).toContain('TRIGGER:-PT1H');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('writes an all-day task as a date with a repeat rule', () => {
    const due = new Date(2026, 9, 5).getTime();
    const ics = toIcs([newItem({ id: 't2', title: 'Quiz', due, status: 'todo', recurrence: { freq: 'weekly', interval: 1 } })], now);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261005');
    expect(ics).toContain('DTEND;VALUE=DATE:20261006');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=1');
  });

  it('skips items without a due date and keeps private notes out', () => {
    const ics = toIcs([newItem({ id: 'x', title: 'no date' }), newItem({ id: 'p', title: 'Secret', due: now, private: true, body: 'pin 1234' })], now);
    expect(ics).not.toContain('no date');
    expect(ics).not.toContain('1234');
  });
});
