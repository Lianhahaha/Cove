import { describe, expect, it } from 'vitest';
import { rateLimit } from './rate-limit';

describe('rateLimit', () => {
  it('allows up to the limit per window', () => {
    const t = 1_000_000;
    expect(rateLimit('a', 2, 1000, t).ok).toBe(true);
    expect(rateLimit('a', 2, 1000, t + 1).ok).toBe(true);
    expect(rateLimit('a', 2, 1000, t + 2)).toEqual({ ok: false, retryAfter: 1 });
    expect(rateLimit('a', 2, 1000, t + 1001).ok).toBe(true);
  });

  it('does not let short-window cleanup reset a long-window counter', () => {
    const t = 5_000_000;
    const DAY = 86_400_000;
    rateLimit('daily', 1, DAY, t);
    // Fill the map past its cleanup threshold with short-lived keys, well after the short window.
    for (let i = 0; i < 5001; i++) rateLimit(`ip:${i}`, 10, 1000, t + 5000);
    expect(rateLimit('daily', 1, DAY, t + 10_000).ok).toBe(false);
  });
});
