import { describe, expect, it } from 'vitest';
import { monthGrid } from './week';

describe('monthGrid', () => {
  it('starts on the Sunday on or before the 1st by default', () => {
    const days = monthGrid(new Date(2026, 8, 1), 0); // Sep 1, 2026 is a Tuesday
    expect(days).toHaveLength(42);
    expect(days[0]).toEqual(new Date(2026, 7, 30));
    expect(days[41]).toEqual(new Date(2026, 9, 10));
  });

  it('starts on the Monday on or before the 1st when the week starts on Monday', () => {
    const days = monthGrid(new Date(2026, 8, 1), 1);
    expect(days[0]).toEqual(new Date(2026, 7, 31));
    expect(days[41]).toEqual(new Date(2026, 9, 11));
  });

  it('keeps the first of the month in the first row when it is already the week start', () => {
    const days = monthGrid(new Date(2026, 7, 1), 0); // Aug 1, 2026 is a Saturday
    expect(days[0]).toEqual(new Date(2026, 6, 26));
    expect(monthGrid(new Date(2026, 10, 1), 0)[0]).toEqual(new Date(2026, 10, 1)); // Nov 1, 2026 is a Sunday
  });
});
