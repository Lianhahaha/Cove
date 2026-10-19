import { describe, expect, it } from 'vitest';
import { fuzzyMatch, fuzzyScore } from './fuzzy';

describe('fuzzyScore', () => {
  it('matches initials across words', () => {
    expect(fuzzyScore('Go to Tasks', 'gt')).not.toBeNull();
    expect(fuzzyScore('Go to Tags', 'gt')).not.toBeNull();
  });

  it('fails when a letter is nowhere to be found', () => {
    expect(fuzzyScore('Go to Tasks', 'gx')).toBeNull();
    expect(fuzzyScore('Notes', 'z')).toBeNull();
  });

  it('prefers letters at word starts and nearby', () => {
    // "ts" both start words in Tasks; in Settings they sit mid-word.
    expect(fuzzyScore('Tasks', 'ts')!).toBeGreaterThan(fuzzyScore('Settings', 'ts')!);
  });

  it('rewards exact prefixes over mid-string hits', () => {
    expect(fuzzyScore('Search', 'sea')!).toBeGreaterThan(fuzzyScore('Go to Search', 'sea')!);
  });
});

describe('fuzzyMatch', () => {
  it('needs every word of the query', () => {
    expect(fuzzyMatch('Go to Tasks', 'go tasks')).not.toBeNull();
    expect(fuzzyMatch('Go to Tasks', 'go tags')).toBeNull();
  });

  it('treats an empty query as matching everything', () => {
    expect(fuzzyMatch('Anything', '')).toBe(0);
  });
});
