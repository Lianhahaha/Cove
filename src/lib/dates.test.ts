import { describe, expect, it } from 'vitest';
import { DUE_SHORTCUTS, formatDue } from './dates';

const day = (label: string, now: Date) => DUE_SHORTCUTS.find((s) => s.label === label)!.day(now);

describe('DUE_SHORTCUTS', () => {
  it('gives today, tomorrow and next Monday at midnight', () => {
    const wed = new Date(2026, 8, 23, 15, 45);
    expect(day('Today', wed)).toEqual(new Date(2026, 8, 23));
    expect(day('Tomorrow', wed)).toEqual(new Date(2026, 8, 24));
    expect(day('Next week', wed)).toEqual(new Date(2026, 8, 28));
  });

  it('skips a full week when today is Monday', () => {
    expect(day('Next week', new Date(2026, 8, 28, 9))).toEqual(new Date(2026, 9, 5));
  });
});

describe('formatDue', () => {
  const now = new Date(2026, 8, 23, 9);
  const due = new Date(2026, 8, 23, 17, 5).getTime();

  it('spells the day out for today and tomorrow', () => {
    expect(formatDue(new Date(2026, 8, 24).getTime(), false, now)).toBe('Tomorrow');
  });

  it('forces 24-hour times when the option is on, midnight included', () => {
    const out = formatDue(due, true, now, true);
    expect(out).toContain('17');
    expect(out).not.toMatch(/[ap]\.?m/i);
    expect(formatDue(new Date(2026, 8, 24).getTime(), true, now, true)).toContain('00:00');
  });

  it('never lets a bad date throw', () => {
    expect(formatDue(Number.NaN, false, now)).toBe('');
  });
});
