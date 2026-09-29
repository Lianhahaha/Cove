import { describe, expect, it } from 'vitest';
import { stepsFromText } from './checklist';

describe('stepsFromText', () => {
  it('makes a step of each line without its bullet, number or box', () => {
    expect(stepsFromText('- Intro\n* Methods\r\n1. Results\n2) Discussion\n\n• Sources')).toEqual(
      ['Intro', 'Methods', 'Results', 'Discussion', 'Sources'].map((text) => ({ text, done: false })),
    );
  });

  it('keeps ticked boxes done', () => {
    expect(stepsFromText('- [x] Outline\n- [ ] Draft\n[X] Title page')).toEqual([
      { text: 'Outline', done: true },
      { text: 'Draft', done: false },
      { text: 'Title page', done: true },
    ]);
  });

  it('leaves numbers that start the text alone', () => {
    expect(stepsFromText('1.5 hours of reading\n3 problems')).toEqual([
      { text: '1.5 hours of reading', done: false },
      { text: '3 problems', done: false },
    ]);
  });
});
