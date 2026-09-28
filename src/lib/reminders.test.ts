import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { moveReminder } from './reminders';

const at = (d: number, h = 0, min = 0) => new Date(2026, 9, d, h, min).getTime();

describe('moveReminder', () => {
  it('keeps the same distance when the date moves', () => {
    expect(moveReminder(at(5, 8), { due: at(5, 9), dueHasTime: true }, { due: at(7, 9), dueHasTime: true })).toBe(at(7, 8));
  });

  it('keeps "at the due time" when a time is added to a date-only task', () => {
    // Date-only reminders count from 9am, so 9am on the day is "at the due time".
    expect(moveReminder(at(5, 9), { due: at(5), dueHasTime: false }, { due: at(5, 14), dueHasTime: true })).toBe(at(5, 14));
  });

  it('keeps "1 hour before" when the time is removed', () => {
    expect(moveReminder(at(5, 13), { due: at(5, 14), dueHasTime: true }, { due: at(5), dueHasTime: false })).toBe(at(5, 8));
  });

  it('drops the reminder with the due date and leaves no reminder alone', () => {
    expect(moveReminder(at(5, 8), { due: at(5, 9), dueHasTime: true }, { due: null, dueHasTime: false })).toBeNull();
    expect(moveReminder(null, { due: at(5, 9), dueHasTime: true }, { due: at(6, 9), dueHasTime: true })).toBeNull();
  });
});
