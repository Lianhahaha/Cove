import { describe, expect, it } from 'vitest';
import { finishedPerDay, streak } from './stats';
import { newItem } from './repo';

const now = new Date(2026, 8, 26, 15, 0);
const doneOn = (daysAgo: number, hour = 10) => newItem({ status: 'done', completedAt: new Date(2026, 8, 26 - daysAgo, hour).getTime() });

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    expect(streak([doneOn(0), doneOn(1), doneOn(2), doneOn(4)], now)).toBe(3);
  });
  it('stays alive until today ends', () => {
    expect(streak([doneOn(1), doneOn(2)], now)).toBe(2);
  });
  it('is zero after a missed day', () => {
    expect(streak([doneOn(2), doneOn(3)], now)).toBe(0);
  });
});

describe('finishedPerDay', () => {
  it('buckets by local day, oldest first', () => {
    const series = finishedPerDay([doneOn(0), doneOn(0, 23), doneOn(13), doneOn(20)], 14, now);
    expect(series).toHaveLength(14);
    expect(series[13].count).toBe(2);
    expect(series[0].count).toBe(1);
    expect(series.reduce((n, d) => n + d.count, 0)).toBe(3);
  });
});
