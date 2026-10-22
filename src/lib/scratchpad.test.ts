import { describe, expect, it } from 'vitest';
import { clearScratchpad, scratchpadText, setScratchpadText } from './scratchpad';

describe('scratchpad storage', () => {
  it('updates reactive signal and persists value', () => {
    setScratchpadText('hello world');
    expect(scratchpadText.value).toBe('hello world');

    clearScratchpad();
    expect(scratchpadText.value).toBe('');
  });
});
