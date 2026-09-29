import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { focusedMinutes, type FocusState } from './focus';

const run = (s: Partial<FocusState>): FocusState => ({ itemId: null, title: 'x', mode: 'focus', minutes: 25, endsAt: null, remaining: 25 * 60_000, ...s });

describe('focusedMinutes', () => {
  it('counts whole minutes spent, running or paused', () => {
    const now = 1_000_000_000;
    expect(focusedMinutes(run({ endsAt: now + 15 * 60_000 + 30_000 }), now)).toBe(9);
    expect(focusedMinutes(run({ remaining: 5 * 60_000 }), now)).toBe(20);
  });

  it('counts nothing for a break', () => {
    expect(focusedMinutes(run({ mode: 'break', minutes: 5, remaining: 0 }))).toBe(0);
  });
});
