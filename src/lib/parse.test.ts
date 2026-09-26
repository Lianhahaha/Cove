import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './parse';

// Wednesday, 23 September 2026, 10:00 local time.
const now = new Date(2026, 8, 23, 10, 0);
const day = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const spaces = [
  { id: 's1', name: 'CPE 301' },
  { id: 's2', name: 'Physics' },
];
const p = (text: string) => parseQuickAdd(text, { now, spaces });

describe('links', () => {
  it('detects a bare URL as a link with no title', () => {
    const r = p('https://youtu.be/abc123');
    expect(r).toMatchObject({ kind: 'link', url: 'https://youtu.be/abc123', title: '', isTask: false });
  });

  it('keeps text around the URL as the title and ignores # inside the URL', () => {
    const r = p('Lecture 4 slides https://example.com/doc#page=3 #cpe');
    expect(r.url).toBe('https://example.com/doc#page=3');
    expect(r.title).toBe('Lecture 4 slides');
    expect(r.tags).toEqual(['cpe']);
  });

  it('adds https to www links and trims sentence punctuation', () => {
    expect(p('see www.example.com.').url).toBe('https://www.example.com');
    expect(p('(https://en.wikipedia.org/wiki/Ohm_(unit))').url).toBe('https://en.wikipedia.org/wiki/Ohm_(unit)');
  });
});

describe('tags, priority and space', () => {
  it('pulls out tags, priority and the matching space', () => {
    const r = p('Lab report #lab #Midterm !! @cpe301');
    expect(r).toMatchObject({ title: 'Lab report', tags: ['lab', 'midterm'], priority: 2, spaceId: 's1', isTask: true });
  });

  it('matches a space by prefix and leaves unknown @words alone', () => {
    expect(p('notes @phys').spaceId).toBe('s2');
    const r = p('email @someone');
    expect(r.spaceId).toBeNull();
    expect(r.title).toBe('email @someone');
  });

  it('does not treat a lone exclamation in a sentence as priority', () => {
    expect(p('wow!').priority).toBe(0);
  });

  it('supports explicit task prefixes', () => {
    expect(p('[] buy bond paper')).toMatchObject({ title: 'buy bond paper', isTask: true, due: null });
    expect(p('todo: read ch 3').isTask).toBe(true);
  });
});

describe('dates', () => {
  it('understands relative words, including Filipino', () => {
    expect(p('quiz today').due).toBe(day(2026, 9, 23));
    expect(p('quiz tmr').due).toBe(day(2026, 9, 24));
    expect(p('quiz bukas').due).toBe(day(2026, 9, 24));
    expect(p('review in 3 days').due).toBe(day(2026, 9, 26));
    expect(p('review in 2 weeks').due).toBe(day(2026, 10, 7));
    expect(p('plan next week').due).toBe(day(2026, 9, 28));
  });

  it('resolves weekdays to the coming one, today included', () => {
    expect(p('essay fri').due).toBe(day(2026, 9, 25));
    expect(p('essay wednesday').due).toBe(day(2026, 9, 23));
    expect(p('essay next fri').due).toBe(day(2026, 10, 2));
  });

  it('needs a lead-in for short day names that are also words', () => {
    expect(p('I sat down').due).toBeNull();
    expect(p('I sat down').title).toBe('I sat down');
    expect(p('meet on sat').due).toBe(day(2026, 9, 26));
  });

  it('reads month-day, day-month and M/D, rolling past dates to next year', () => {
    expect(p('defense dec 5').due).toBe(day(2026, 12, 5));
    expect(p('defense 5 December').due).toBe(day(2026, 12, 5));
    expect(p('defense 12/5').due).toBe(day(2026, 12, 5));
    expect(p('enrollment jan 10').due).toBe(day(2027, 1, 10));
    expect(p('old 3/1/2025').due).toBe(day(2025, 3, 1));
  });

  it('keeps a date from the last two months in this year', () => {
    expect(p('overdue lab sep 20').due).toBe(day(2026, 9, 20));
    expect(p('late thing 8/1').due).toBe(day(2026, 8, 1));
  });

  it('rejects impossible dates', () => {
    expect(p('thing 2/31').due).toBeNull();
  });

  it('combines a date and a time', () => {
    const r = p('submit lab due fri 11:59pm');
    expect(r.due).toBe(day(2026, 9, 25, 23, 59));
    expect(r.dueHasTime).toBe(true);
    expect(r.title).toBe('submit lab');
  });

  it('puts a past time with no date on tomorrow', () => {
    expect(p('call at 9am').due).toBe(day(2026, 9, 24, 9));
    expect(p('call at 3pm').due).toBe(day(2026, 9, 23, 15));
    expect(p('lunch noon').due).toBe(day(2026, 9, 23, 12));
  });
});

describe('ignore', () => {
  it('leaves switched-off parts in the title', () => {
    const r = parseQuickAdd('Friday night lights fri', { now, ignore: new Set(['due']) });
    expect(r.due).toBeNull();
    expect(r.title).toBe('Friday night lights fri');
  });
});
