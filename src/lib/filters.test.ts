import { describe, expect, it } from 'vitest';
import { hasFilters, matchesFilters, parseSearchQuery } from './filters';
import { newItem } from './repo';

describe('parseSearchQuery', () => {
  it('splits filters from the words', () => {
    expect(parseSearchQuery('kirchhoff is:task tag:Lab type:link')).toEqual({ text: 'kirchhoff', is: ['task'], kinds: ['link'], tags: ['lab'] });
  });

  it('accepts aliases and ignores repeats', () => {
    expect(parseSearchQuery('is:fav is:starred kind:notes is:todo').is).toEqual(['favorite', 'open']);
    expect(parseSearchQuery('kind:notes').kinds).toEqual(['note']);
  });

  it('keeps unknown filters and plain words as text', () => {
    const q = parseSearchQuery('is:blue https://x.com tag:');
    expect(q.text).toBe('is:blue https://x.com tag:');
    expect(hasFilters(q)).toBe(false);
  });
});

describe('matchesFilters', () => {
  const now = new Date(2026, 8, 23, 10);
  const lab = newItem({ title: 'Lab', kind: 'link', tags: ['lab', 'cpe'], status: 'todo', due: new Date(2026, 8, 20).getTime() });
  const note = newItem({ title: 'Notes', tags: ['lab'], pinned: true });
  const done = newItem({ title: 'Quiz', status: 'done', recurrence: { freq: 'weekly', interval: 1 } });
  const match = (q: string) => [lab, note, done].filter((i) => matchesFilters(i, parseSearchQuery(q), now)).map((i) => i.title);

  it('filters by status', () => {
    expect(match('is:task')).toEqual(['Lab', 'Quiz']);
    expect(match('is:open')).toEqual(['Lab']);
    expect(match('is:done')).toEqual(['Quiz']);
    expect(match('is:overdue')).toEqual(['Lab']);
    expect(match('is:repeating')).toEqual(['Quiz']);
    expect(match('is:pinned')).toEqual(['Notes']);
  });

  it('needs every tag but any kind', () => {
    expect(match('tag:lab')).toEqual(['Lab', 'Notes']);
    expect(match('tag:lab tag:cpe')).toEqual(['Lab']);
    expect(match('type:link type:note')).toEqual(['Lab', 'Notes', 'Quiz']);
    expect(match('type:link')).toEqual(['Lab']);
  });

  it('never matches items in the trash', () => {
    const trashed = newItem({ title: 'Old', deletedAt: 1 });
    expect(matchesFilters(trashed, parseSearchQuery(''), now)).toBe(false);
  });
});
