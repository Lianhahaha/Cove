import { describe, expect, it } from 'vitest';
import { autoTagsFor } from './autotag';

describe('autoTagsFor', () => {
  it.each([
    ['https://www.youtube.com/watch?v=1', ['video']],
    ['https://youtu.be/abc', ['video']],
    ['https://github.com/Lianhahaha/Cove', ['code']],
    ['https://docs.google.com/document/d/1', ['docs']],
    ['https://classroom.google.com/c/1', ['classroom']],
    ['https://us02web.zoom.us/j/1', ['meeting']],
    ['https://en.wikipedia.org/wiki/Ohm', ['wiki']],
    ['https://example.com', []],
    ['https://notyoutube.com', []],
  ])('%s', (url, tags) => expect(autoTagsFor(url)).toEqual(tags));

  it('handles no URL or a broken one', () => {
    expect(autoTagsFor(null)).toEqual([]);
    expect(autoTagsFor('not a url')).toEqual([]);
  });
});
