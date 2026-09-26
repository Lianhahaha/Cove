import { describe, expect, it } from 'vitest';
import { createIndex, toDoc } from './search';
import { newItem } from './repo';

function indexOf(...items: ReturnType<typeof newItem>[]) {
  const index = createIndex();
  index.addAll(
    items.map((i) =>
      toDoc(
        i,
        i.id === 'b' ? [{ name: 'Thevenin worksheet.pdf', text: 'Norton equivalent networks and superposition' }] : i.id === 's' ? [{ name: 'statement.pdf', text: 'account balance 99999' }] : [],
      ),
    ),
  );
  return (q: string) => index.search(q).map((r) => r.id);
}

describe('search index', () => {
  const a = newItem({ id: 'a', title: 'Kirchhoff laws lab', tags: ['circuits'], body: 'voltage divider notes' });
  const b = newItem({ id: 'b', title: 'Problem set 3' });
  const c = newItem({ id: 'c', url: 'https://www.youtube.com/watch?v=1', preview: { status: 'ok', title: 'Recursion explained' } });
  const secret = newItem({ id: 's', title: 'Bank stuff', body: 'pin 4321', private: true });
  const find = indexOf(a, b, c, secret);

  it('matches titles by prefix and tolerates typos in longer words', () => {
    expect(find('kirch')).toEqual(['a']);
    expect(find('kirchoff')).toEqual(['a']);
    expect(find('kirchof')).toEqual(['a']);
  });

  it('searches tags, descriptions, link previews, hosts and file names', () => {
    expect(find('circuits')).toEqual(['a']);
    expect(find('divider')).toEqual(['a']);
    expect(find('recursion')).toEqual(['c']);
    expect(find('youtube')).toEqual(['c']);
    expect(find('thevenin')).toEqual(['b']);
  });

  it('finds words inside PDFs', () => {
    expect(find('superposition')).toEqual(['b']);
  });

  it('requires every word to match', () => {
    expect(find('kirchhoff notes')).toEqual(['a']);
    expect(find('kirchhoff recursion')).toEqual([]);
  });

  it('keeps the contents of private items out of the index', () => {
    expect(find('4321')).toEqual([]);
    expect(find('bank')).toEqual(['s']);
    expect(find('99999')).toEqual([]);
    expect(find('statement')).toEqual(['s']);
  });
});
