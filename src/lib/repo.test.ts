import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  addFile,
  addItem,
  addSpace,
  archiveSemester,
  unarchiveSemester,
  emptyTrash,
  FileTooLargeError,
  LIMITS,
  normalizeTag,
  purgeExpiredTrash,
  restoreItems,
  restoreSpace,
  trashItems,
  trashSpace,
  TRASH_DAYS,
  updateItem,
} from './repo';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('normalizeTag', () => {
  it('strips #, lowercases and dashes spaces', () => {
    expect(normalizeTag('#Midterm Exam')).toBe('midterm-exam');
  });
  it('drops punctuation but keeps non-Latin letters', () => {
    expect(normalizeTag('ñame!?')).toBe('ñame');
  });
  it('caps length', () => {
    expect(normalizeTag('a'.repeat(100))).toHaveLength(LIMITS.tagChars);
  });
});

describe('items', () => {
  it('fills defaults and dedupes tags', async () => {
    const item = await addItem({ title: 'Lab 3', tags: ['#Lab', 'lab', 'CPE'] });
    const stored = await db.items.get(item.id);
    expect(stored?.tags).toEqual(['lab', 'cpe']);
    expect(stored?.status).toBe('none');
    expect(stored?.deletedAt).toBeNull();
  });

  it('bumps updatedAt and never changes id or createdAt', async () => {
    const item = await addItem({ title: 'a' });
    await new Promise((r) => setTimeout(r, 2));
    await updateItem(item.id, { title: 'b', id: 'other', createdAt: 1 } as never);
    const stored = await db.items.get(item.id);
    expect(stored?.title).toBe('b');
    expect(stored?.createdAt).toBe(item.createdAt);
    expect(stored!.updatedAt).toBeGreaterThan(item.updatedAt);
  });

  it('clamps long titles', async () => {
    const item = await addItem({ title: 'x'.repeat(1000) });
    expect(item.title).toHaveLength(LIMITS.titleChars);
  });
});

describe('trash', () => {
  it('trashes, restores and empties', async () => {
    const a = await addItem({ title: 'a' });
    const b = await addItem({ title: 'b' });
    await trashItems([a.id, b.id]);
    expect((await db.items.get(a.id))?.deletedAt).toBeTypeOf('number');

    await restoreItems([a.id]);
    expect((await db.items.get(a.id))?.deletedAt).toBeNull();

    expect(await emptyTrash()).toBe(1);
    expect(await db.items.get(b.id)).toBeUndefined();
  });

  it('restores into the Inbox when the space is gone', async () => {
    const space = await addSpace({ name: 'CPE 301' });
    const item = await addItem({ spaceId: space.id });
    await trashSpace(space.id, 'trash');
    expect((await db.items.get(item.id))?.deletedAt).toBeTypeOf('number');
    await restoreItems([item.id]);
    expect((await db.items.get(item.id))?.spaceId).toBeNull();
  });

  it('purges only items past the retention window, with their files', async () => {
    const old = await addItem({ title: 'old' });
    const fresh = await addItem({ title: 'fresh' });
    await addFile(old.id, new Blob(['hi'], { type: 'text/plain' }), 'hi.txt');
    const now = Date.now();
    await db.items.update(old.id, { deletedAt: now - (TRASH_DAYS + 1) * 86_400_000 });
    await db.items.update(fresh.id, { deletedAt: now - 86_400_000 });

    expect(await purgeExpiredTrash(now)).toBe(1);
    expect(await db.items.get(old.id)).toBeUndefined();
    expect(await db.files.where('itemId').equals(old.id).count()).toBe(0);
    expect(await db.items.get(fresh.id)).toBeDefined();
  });
});

describe('spaces', () => {
  it('moves items to the Inbox when deleting with "inbox"', async () => {
    const space = await addSpace({ name: '  Physics  ' });
    expect(space.name).toBe('Physics');
    const item = await addItem({ spaceId: space.id });
    await trashSpace(space.id, 'inbox');
    const stored = await db.items.get(item.id);
    expect(stored?.spaceId).toBeNull();
    expect(stored?.deletedAt).toBeNull();
  });

  it('restores a space with the items deleted along with it', async () => {
    const space = await addSpace({ name: 'Chem' });
    const kept = await addItem({ spaceId: space.id });
    const trashedBefore = await addItem({ spaceId: space.id });
    await trashItems([trashedBefore.id]);
    await new Promise((r) => setTimeout(r, 2));
    await trashSpace(space.id, 'trash');

    expect(await restoreSpace(space.id)).toBe(1);
    expect((await db.spaces.get(space.id))?.deletedAt).toBeNull();
    expect((await db.items.get(kept.id))?.deletedAt).toBeNull();
    // Deleted on its own earlier, so it stays in the trash.
    expect((await db.items.get(trashedBefore.id))?.deletedAt).toBeTypeOf('number');
  });
});

describe('files', () => {
  it('rejects files over the size limit', async () => {
    const item = await addItem();
    const big = { size: LIMITS.fileBytes + 1, type: 'application/pdf', name: 'big.pdf' } as File;
    await expect(addFile(item.id, big)).rejects.toBeInstanceOf(FileTooLargeError);
  });
});

describe('archiveSemester', () => {
  it('archives spaces with their items and can be undone', async () => {
    const a = await addSpace({ name: 'Physics' });
    const inA = await addItem({ spaceId: a.id });
    const inbox = await addItem({ spaceId: null });
    const changed = await archiveSemester();
    expect(changed).toEqual({ spaceIds: [a.id], itemIds: [inA.id] });
    expect((await db.spaces.get(a.id))?.archived).toBe(true);
    expect((await db.items.get(inA.id))?.archived).toBe(true);
    expect((await db.items.get(inbox.id))?.archived).toBe(false);
    await unarchiveSemester(changed);
    expect((await db.items.get(inA.id))?.archived).toBe(false);
  });
});
