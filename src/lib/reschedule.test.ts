import { describe, expect, it } from 'vitest';
import { presetDue } from './reschedule';

// Wednesday, October 14 2026, 3:30pm.
const now = new Date(2026, 9, 14, 15, 30);

describe('presetDue', () => {
  it('keeps the time of day for timed tasks', () => {
    const d = new Date(presetDue('tomorrow', { hours: 17, minutes: 45 }, now));
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(17);
    expect(d.getMinutes()).toBe(45);
  });

  it('lands at the start of the day without a time', () => {
    const d = new Date(presetDue('today', null, now));
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('points Next week at next Monday from mid-week', () => {
    const d = new Date(presetDue('nextweek', null, now));
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(19);
  });

  it('gives a whole week when today is already Monday', () => {
    const monday = new Date(2026, 9, 12, 9, 0);
    const d = new Date(presetDue('nextweek', null, monday));
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(19);
  });

  it('takes Next week to tomorrow when today is Sunday', () => {
    const sunday = new Date(2026, 9, 18, 14, 0);
    const d = new Date(presetDue('nextweek', null, sunday));
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(19);
  });
});
