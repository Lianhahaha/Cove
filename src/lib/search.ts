import MiniSearch from 'minisearch';
import { liveQuery } from 'dexie';
import { signal } from '@preact/signals';
import { db } from './db';
import { hostOf } from './queries';
import type { Item } from './types';

interface Doc {
  id: string;
  title: string;
  body: string;
  url: string;
  tags: string;
  preview: string;
  files: string;
}

export interface FileText {
  name: string;
  text?: string;
}

/** Indexes every item that isn't in the trash. Private items are searchable by title and file names only. */
export function toDoc(item: Item, files: FileText[] = []): Doc {
  return {
    id: item.id,
    title: item.title,
    body: item.private ? '' : item.body,
    url: item.url ? `${hostOf(item.url)} ${item.url}` : '',
    tags: item.tags.join(' '),
    preview: item.private ? '' : [item.preview?.title, item.preview?.description, item.preview?.siteName].filter(Boolean).join(' '),
    files: files.map((f) => (item.private ? f.name : `${f.name} ${f.text ?? ''}`)).join(' '),
  };
}

export function createIndex(): MiniSearch<Doc> {
  return new MiniSearch<Doc>({
    fields: ['title', 'body', 'url', 'tags', 'preview', 'files'],
    storeFields: [],
    searchOptions: {
      boost: { title: 3, tags: 2, preview: 1.5, files: 1.5 },
      prefix: true,
      // No typos allowed in short words, one in medium words, two in long ones.
      fuzzy: (term) => (term.length > 6 ? 0.3 : term.length > 4 ? 0.2 : false),
      combineWith: 'AND',
    },
  });
}

export const searchIndex = signal<MiniSearch<Doc> | null>(null);

let started = false;

/** Keeps an in-memory index in step with the database. */
export function startSearchIndex(): void {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  liveQuery(async () => {
    const items = await db.items.filter((i) => !i.deletedAt).toArray();
    const names = new Map<string, FileText[]>();
    // File names plus any text read from PDFs. Blobs come back as handles and aren't read.
    await db.files.each((f) => names.set(f.itemId, [...(names.get(f.itemId) ?? []), { name: f.name, text: f.text }]));
    return items.map((i) => toDoc(i, names.get(i.id)));
  }).subscribe({
    next: (docs) => {
      clearTimeout(timer);
      // Rebuilding is fast for thousands of items; debounce bursts of edits.
      timer = setTimeout(() => {
        const index = createIndex();
        index.addAll(docs);
        searchIndex.value = index;
      }, 150);
    },
    error: (e) => console.error('Search index failed', e),
  });
}

export function search(query: string, limit = 200): string[] {
  const index = searchIndex.value;
  const q = query.trim();
  if (!index || !q) return [];
  return index.search(q).slice(0, limit).map((r) => r.id as string);
}
