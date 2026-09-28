import { describe, expect, it } from 'vitest';
import { readingStats } from './snippet';

describe('readingStats', () => {
  it('counts words the reader sees, not Markdown syntax', () => {
    expect(readingStats('## Notes\n\n- [x] read **ch 3**\n- see [the slides](https://x.y/a-b-c)\n\n---')).toEqual({ words: 7, minutes: 1 });
  });

  it('rounds reading time to whole minutes', () => {
    expect(readingStats('word '.repeat(700)).minutes).toBe(4);
    expect(readingStats('').words).toBe(0);
  });
});
