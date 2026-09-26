import { db } from './db';
import type { Item, Space, StoredFile } from './types';
import { suggestEmoji } from './spaceIcons';

export const LIMITS = {
  titleChars: 300,
  bodyChars: 100_000,
  tagChars: 32,
  tagsPerItem: 20,
  checklistEntries: 100,
  fileBytes: 25 * 1024 * 1024,
  spaceNameChars: 60,
} as const;

export const TRASH_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export const uid = (): string => crypto.randomUUID();

/** Lowercase, no leading '#', spaces become dashes, letters/digits/_/- only. */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, LIMITS.tagChars);
}

export function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const n = normalizeTag(t);
    if (n && !out.includes(n)) out.push(n);
    if (out.length >= LIMITS.tagsPerItem) break;
  }
  return out;
}

/** Keeps stored text within limits no matter which screen wrote it. */
function clampItem<T extends Partial<Item>>(patch: T): T {
  const p = { ...patch };
  if (p.title !== undefined) p.title = p.title.slice(0, LIMITS.titleChars);
  if (p.body !== undefined) p.body = p.body.slice(0, LIMITS.bodyChars);
  if (p.tags !== undefined) p.tags = normalizeTags(p.tags);
  if (p.checklist !== undefined) p.checklist = p.checklist.slice(0, LIMITS.checklistEntries);
  return p;
}

export function newItem(partial: Partial<Item> = {}): Item {
  const now = Date.now();
  return clampItem({
    id: uid(),
    kind: 'note',
    title: '',
    body: '',
    url: null,
    preview: null,
    spaceId: null,
    tags: [],
    pinned: false,
    favorite: false,
    archived: false,
    private: false,
    status: 'none',
    due: null,
    dueHasTime: false,
    priority: 0,
    checklist: [],
    recurrence: null,
    remindAt: null,
    estimateMins: null,
    completedAt: null,
    order: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  });
}

export async function addItem(partial: Partial<Item> = {}): Promise<Item> {
  const item = newItem(partial);
  await db.items.add(item);
  return item;
}

export async function updateItem(id: string, patch: Partial<Item>): Promise<void> {
  const { id: _ignored, createdAt: _c, ...rest } = patch;
  await db.items.update(id, { ...clampItem(rest), updatedAt: Date.now() });
}

export async function trashItems(ids: string[]): Promise<void> {
  const now = Date.now();
  await db.items.where('id').anyOf(ids).modify({ deletedAt: now, updatedAt: now });
}

export async function restoreItems(ids: string[]): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.items, db.spaces, async () => {
    const items = await db.items.bulkGet(ids);
    for (const item of items) {
      if (!item) continue;
      // Restoring into a deleted space would hide the item, so send it to the Inbox.
      const space = item.spaceId ? await db.spaces.get(item.spaceId) : null;
      const spaceId = space && !space.deletedAt ? item.spaceId : null;
      await db.items.update(item.id, { deletedAt: null, spaceId, updatedAt: now });
    }
  });
}

/** Deletes items and their files for good. */
export async function purgeItems(ids: string[]): Promise<void> {
  await db.transaction('rw', db.items, db.files, async () => {
    await db.files.where('itemId').anyOf(ids).delete();
    await db.items.bulkDelete(ids);
  });
}

export async function emptyTrash(): Promise<number> {
  const ids = (await db.items.where('deletedAt').above(0).primaryKeys()) as string[];
  await purgeItems(ids);
  return ids.length;
}

/** Removes items that have been in the trash longer than TRASH_DAYS. */
export async function purgeExpiredTrash(now = Date.now()): Promise<number> {
  const cutoff = now - TRASH_DAYS * DAY;
  const ids = (await db.items.where('deletedAt').between(1, cutoff, true, true).primaryKeys()) as string[];
  if (ids.length) await purgeItems(ids);
  const spaceIds = (await db.spaces.where('deletedAt').between(1, cutoff, true, true).primaryKeys()) as string[];
  if (spaceIds.length) await db.spaces.bulkDelete(spaceIds);
  return ids.length;
}

// ─── Spaces ──────────────────────────────────────────────────────────────

export const SPACE_COLORS = ['#684c96', '#3f6fb5', '#2f8a6a', '#b0752a', '#b5485d', '#5b6b7a', '#8a5a44', '#6a7f2c'];

export async function addSpace(partial: Partial<Space> = {}): Promise<Space> {
  const now = Date.now();
  const count = await db.spaces.count();
  // New spaces take an emoji that fits the name and a color no other space has, so they're easy to tell apart.
  const others = (await db.spaces.toArray()).filter((s) => !s.deletedAt);
  const usedColors = new Set(others.map((s) => s.color));
  const space: Space = {
    id: uid(),
    name: 'Untitled',
    emoji: suggestEmoji(partial.name ?? '', others.map((s) => s.emoji)),
    color: SPACE_COLORS.find((c) => !usedColors.has(c)) ?? SPACE_COLORS[count % SPACE_COLORS.length],
    order: count,
    archived: false,
    aiExcluded: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  };
  space.name = space.name.trim().slice(0, LIMITS.spaceNameChars) || 'Untitled';
  await db.spaces.add(space);
  return space;
}

export async function updateSpace(id: string, patch: Partial<Space>): Promise<void> {
  const p = { ...patch };
  if (p.name !== undefined) p.name = p.name.trim().slice(0, LIMITS.spaceNameChars) || 'Untitled';
  await db.spaces.update(id, { ...p, updatedAt: Date.now() });
}

/**
 * Sends a space to the trash. Its items either move to the Inbox or go to
 * the trash with it.
 */
export async function trashSpace(id: string, items: 'inbox' | 'trash'): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.items, db.spaces, async () => {
    const coll = db.items.where('spaceId').equals(id).filter((i) => !i.deletedAt);
    if (items === 'inbox') await coll.modify({ spaceId: null, updatedAt: now });
    else await coll.modify({ deletedAt: now, updatedAt: now });
    await db.spaces.update(id, { deletedAt: now, updatedAt: now });
  });
}

export async function reorderSpaces(idsInOrder: string[]): Promise<void> {
  await db.transaction('rw', db.spaces, async () => {
    await Promise.all(idsInOrder.map((id, order) => db.spaces.update(id, { order })));
  });
}

// ─── Files ───────────────────────────────────────────────────────────────

export class FileTooLargeError extends Error {
  constructor(public fileName: string) {
    super(`${fileName} is larger than ${LIMITS.fileBytes / 1024 / 1024} MB`);
  }
}

export async function addFile(itemId: string, file: File | Blob, name?: string): Promise<StoredFile> {
  const fileName = (name ?? (file as File).name ?? 'file').slice(0, 200);
  if (file.size > LIMITS.fileBytes) throw new FileTooLargeError(fileName);
  const rec: StoredFile = {
    id: uid(),
    itemId,
    name: fileName,
    type: file.type || 'application/octet-stream',
    size: file.size,
    blob: file,
    createdAt: Date.now(),
    // PDFs get their text read in the background so search can find what's inside.
    ...(file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf') ? { textStatus: 'pending' as const } : {}),
  };
  await db.files.add(rec);
  await db.items.update(itemId, { updatedAt: Date.now() });
  return rec;
}

export async function deleteFile(id: string): Promise<void> {
  await db.files.delete(id);
}

// ─── Settings ────────────────────────────────────────────────────────────

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

// ─── Semesters ──────────────────────────────────────────────────────────

/**
 * Archives every active space and the items in it, so a new term starts
 * clean. Returns what changed so the caller can undo it.
 */
export async function archiveSemester(): Promise<{ spaceIds: string[]; itemIds: string[] }> {
  const now = Date.now();
  return db.transaction('rw', db.spaces, db.items, async () => {
    const spaceIds = (await db.spaces.filter((s) => !s.deletedAt && !s.archived).primaryKeys()) as string[];
    const itemIds = (await db.items.filter((i) => !i.deletedAt && !i.archived && i.spaceId !== null && spaceIds.includes(i.spaceId)).primaryKeys()) as string[];
    await db.spaces.where('id').anyOf(spaceIds).modify({ archived: true, updatedAt: now });
    await db.items.where('id').anyOf(itemIds).modify({ archived: true, updatedAt: now });
    return { spaceIds, itemIds };
  });
}

export async function unarchiveSemester(changed: { spaceIds: string[]; itemIds: string[] }): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.spaces, db.items, async () => {
    await db.spaces.where('id').anyOf(changed.spaceIds).modify({ archived: false, updatedAt: now });
    await db.items.where('id').anyOf(changed.itemIds).modify({ archived: false, updatedAt: now });
  });
}
