import type { Item } from './types';

export const isActive = (i: Item) => !i.deletedAt && !i.archived;
export const isOpenTask = (i: Item) => isActive(i) && (i.status === 'todo' || i.status === 'doing');

export type SortMode = 'recent' | 'created' | 'due' | 'title' | 'priority';

export const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Recently edited',
  created: 'Date added',
  due: 'Due date',
  title: 'Title',
  priority: 'Priority',
};

export function displayTitle(i: Item): string {
  return i.title || i.preview?.title || (i.url ? hostOf(i.url) : '') || firstLine(i.body) || 'Untitled';
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const firstLine = (s: string) => s.split('\n').find((l) => l.trim())?.replace(/^[#>*\-\s[\]x]+/i, '').slice(0, 120) ?? '';

/** Pinned first, then by the chosen order. */
export function sortItems(items: Item[], mode: SortMode): Item[] {
  const byMode: Record<SortMode, (a: Item, b: Item) => number> = {
    recent: (a, b) => b.updatedAt - a.updatedAt,
    created: (a, b) => b.createdAt - a.createdAt,
    due: (a, b) => (a.due ?? Infinity) - (b.due ?? Infinity) || b.priority - a.priority,
    title: (a, b) => displayTitle(a).localeCompare(displayTitle(b)),
    priority: (a, b) => b.priority - a.priority || (a.due ?? Infinity) - (b.due ?? Infinity),
  };
  return [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || byMode[mode](a, b));
}
