import { describe, expect, it } from 'vitest';
import { composeShared } from './share';

describe('composeShared', () => {
  it('drops a url that the text already contains', () => {
    expect(composeShared('', 'Watch this https://youtu.be/x', 'https://youtu.be/x')).toBe('Watch this https://youtu.be/x');
  });
  it('keeps title, text and url on separate lines when distinct', () => {
    expect(composeShared('Lecture 4', 'slides for the midterm', 'https://docs.google.com/p')).toBe('Lecture 4\nslides for the midterm\nhttps://docs.google.com/p');
  });
  it('ignores empty parts', () => {
    expect(composeShared(' ', '', 'https://a.b')).toBe('https://a.b');
  });
});
