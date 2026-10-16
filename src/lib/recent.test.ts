import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addRecent, clearRecent, forgetRecent, loadRecent, RECENT_LIMIT } from './recent';

/** A minimal in-memory stand-in for the browser's localStorage. */
function stubStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  });
  return map;
}

beforeEach(() => {
  stubStorage();
});

describe('recent searches', () => {
  it('starts empty', () => {
    expect(loadRecent()).toEqual([]);
  });

  it('keeps the newest first and trims the query', () => {
    addRecent(' calculus ');
    addRecent('notes');
    expect(loadRecent()).toEqual(['notes', 'calculus']);
  });

  it('moves a repeated search to the front instead of duplicating it', () => {
    addRecent('a');
    addRecent('b');
    addRecent('a');
    expect(loadRecent()).toEqual(['a', 'b']);
  });

  it('caps the list', () => {
    for (let i = 0; i < RECENT_LIMIT + 3; i++) addRecent(`q${i}`);
    expect(loadRecent()).toHaveLength(RECENT_LIMIT);
    expect(loadRecent()[0]).toBe(`q${RECENT_LIMIT + 2}`);
  });

  it('ignores blank searches', () => {
    addRecent('   ');
    expect(loadRecent()).toEqual([]);
  });

  it('forgets one and clears all', () => {
    addRecent('a');
    addRecent('b');
    expect(forgetRecent('a')).toEqual(['b']);
    clearRecent();
    expect(loadRecent()).toEqual([]);
  });

  it('survives broken storage data', () => {
    stubStorage().set('cove-recent-searches', 'not json');
    expect(loadRecent()).toEqual([]);
    stubStorage().set('cove-recent-searches', JSON.stringify([1, 'ok', null]));
    expect(loadRecent()).toEqual(['ok']);
  });
});
