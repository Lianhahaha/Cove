import { describe, expect, it } from 'vitest';
import { finishedPerDay, focusPerDay, streak } from './stats';
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

describe('focusPerDay', () => {
  it('aggregates focus minutes per local day', () => {
    const today = new Date(2026, 8, 26, 12, 0).getTime();
    const yesterday = new Date(2026, 8, 25, 14, 0).getTime();
    const sessions = [
      { itemId: null, minutes: 25, at: today },
      { itemId: null, minutes: 15, at: today },
      { itemId: null, minutes: 50, at: yesterday },
    ];
    const series = focusPerDay(sessions, 14, now);
    expect(series).toHaveLength(14);
    expect(series[13].minutes).toBe(40);
    expect(series[12].minutes).toBe(50);
  });
});
