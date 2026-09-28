import { describe, expect, it } from 'vitest';
import { DUE_SHORTCUTS } from './dates';

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
