import { db } from './db';
import { addItem, purgeItems } from './repo';
import type { Item } from './types';

/**
 * Starts a note. With no text the editor opens on it with the title focused;
 * with text, the first line becomes the title and the rest the body.
 */
export function createNote(spaceId: string | null = null, text = ''): Promise<Item> {
  const [first = '', ...rest] = text.trim().split('\n');
  return addItem({ kind: 'note', spaceId, title: first.trim().slice(0, 300), body: rest.join('\n').trim() });
}

/** A note with nothing in it: no text, link, tags, checklist, task, flags or files. */
export function isBlankNote(item: Item, fileCount: number): boolean {
  return (
    item.kind === 'note' &&
    !item.title.trim() &&
    !item.body.trim() &&
    !item.url &&
    item.tags.length === 0 &&
    item.checklist.length === 0 &&
    item.status === 'none' &&
    !item.pinned &&
    !item.favorite &&
    fileCount === 0
  );
}

/** Deletes a note that was left empty, so tapping New note and backing out leaves nothing behind. */
export async function discardIfBlank(id: string): Promise<boolean> {
  const item = await db.items.get(id);
  if (!item) return false;
  const files = await db.files.where('itemId').equals(id).count();
  if (!isBlankNote(item, files)) return false;
  await purgeItems([id]);
  return true;
}
