import { describe, expect, it } from 'vitest';
import { markdownSnippet } from './markdown';

describe('markdownSnippet', () => {
  it('drops task-list checkboxes', () => {
    expect(markdownSnippet('- [ ] outline\n- [x] data')).toBe('outline data');
  });
  it('keeps link text and drops images, emphasis and headings', () => {
    expect(markdownSnippet('# Title\nSee [the docs](https://x.y) ![pic](a.png) **now**')).toBe('Title See the docs now');
  });
});
