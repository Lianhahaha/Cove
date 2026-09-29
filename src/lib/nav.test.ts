import { describe, expect, it } from 'vitest';
import { itemUrl } from './nav';

describe('itemUrl', () => {
  it('keeps the page query when opening and closing an item', () => {
    expect(itemUrl('/search', { q: 'ohm law', in: 'all' }, 'abc')).toBe('/search?q=ohm+law&in=all&item=abc');
    expect(itemUrl('/search', { q: 'ohm law', item: 'abc' }, null)).toBe('/search?q=ohm+law');
  });

  it('replaces an open item and leaves a bare path bare', () => {
    expect(itemUrl('/tasks', { item: 'a' }, 'b')).toBe('/tasks?item=b');
    expect(itemUrl('/tasks', { item: 'a' }, null)).toBe('/tasks');
  });
});
