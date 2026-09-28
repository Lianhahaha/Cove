import type { Item, ItemKind } from './types';
import { dueBucket } from './dates';
import { normalizeTag } from './repo';

export type IsFilter = 'task' | 'open' | 'done' | 'overdue' | 'pinned' | 'favorite' | 'private' | 'archived' | 'repeating';

/** A search box query split into words for the index and filters like is:done or tag:lab. */
export interface SearchQuery {
  text: string;
  is: IsFilter[];
  /** Any of these kinds. */
  kinds: ItemKind[];
  /** Every one of these tags. */
  tags: string[];
}

const IS_WORDS: Record<string, IsFilter> = {
  task: 'task',
  tasks: 'task',
  open: 'open',
  todo: 'open',
  done: 'done',
  overdue: 'overdue',
  pinned: 'pinned',
  fav: 'favorite',
  favorite: 'favorite',
  favourite: 'favorite',
  starred: 'favorite',
  private: 'private',
  archived: 'archived',
  repeating: 'repeating',
  recurring: 'repeating',
};

const KIND_WORDS: Record<string, ItemKind> = { link: 'link', links: 'link', note: 'note', notes: 'note', file: 'file', files: 'file' };

/** The filters shown as examples under the search box. */
export const FILTER_EXAMPLES = ['is:task', 'is:done', 'is:overdue', 'is:pinned', 'type:link', 'type:file', 'tag:'];

const isOpen = (i: Item) => i.status === 'todo' || i.status === 'doing';

const IS_CHECKS: Record<IsFilter, (i: Item, now: Date) => boolean> = {
  task: (i) => i.status !== 'none',
  open: isOpen,
  done: (i) => i.status === 'done',
  overdue: (i, now) => isOpen(i) && dueBucket(i.due, i.dueHasTime, now) === 'overdue',
  pinned: (i) => i.pinned,
  favorite: (i) => i.favorite,
  private: (i) => i.private,
  archived: (i) => i.archived,
  repeating: (i) => i.recurrence !== null,
};

/** Unknown filters, like "is:blue" or "http://x", stay in the text. */
export function parseSearchQuery(query: string): SearchQuery {
  const out: SearchQuery = { text: '', is: [], kinds: [], tags: [] };
  const words: string[] = [];
  const add = <T>(list: T[], v: T) => !list.includes(v) && list.push(v);
  for (const word of query.trim().split(/\s+/).filter(Boolean)) {
    const m = /^(is|type|kind|tag):(.+)$/i.exec(word);
    if (m) {
      const key = m[1].toLowerCase();
      const value = m[2].toLowerCase();
      // Own keys only, so "is:constructor" isn't read off the object's prototype.
      if (key === 'is' && Object.hasOwn(IS_WORDS, value)) {
        add(out.is, IS_WORDS[value]);
        continue;
      }
      if ((key === 'type' || key === 'kind') && Object.hasOwn(KIND_WORDS, value)) {
        add(out.kinds, KIND_WORDS[value]);
        continue;
      }
      const tag = key === 'tag' ? normalizeTag(value) : '';
      if (tag) {
        add(out.tags, tag);
        continue;
      }
    }
    words.push(word);
  }
  out.text = words.join(' ');
  return out;
}

export const hasFilters = (q: SearchQuery) => q.is.length + q.kinds.length + q.tags.length > 0;

/** Whether an item passes the query's filters. Items in the trash never do. */
export function matchesFilters(item: Item, q: SearchQuery, now = new Date()): boolean {
  if (item.deletedAt) return false;
  if (q.kinds.length && !q.kinds.includes(item.kind)) return false;
  if (!q.tags.every((t) => item.tags.includes(t))) return false;
  return q.is.every((f) => IS_CHECKS[f](item, now));
}
