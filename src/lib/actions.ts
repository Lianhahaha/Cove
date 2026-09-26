import { db } from './db';
import { addItem, restoreItems, trashItems, updateItem } from './repo';
import { toast } from './toast';
import type { Item } from './types';
import type { Parsed } from './parse';

/** Creates an item from parsed quick-add text. */
export async function createFromParsed(p: Parsed, extra: Partial<Item> = {}): Promise<Item> {
  return addItem({
    kind: p.kind,
    title: p.title,
    url: p.url,
    // Links wait in the preview queue until the app is online.
    preview: p.url ? { status: 'pending' } : null,
    tags: p.tags,
    priority: p.priority,
    spaceId: p.spaceId,
    due: p.due,
    dueHasTime: p.dueHasTime,
    status: p.isTask ? 'todo' : 'none',
    ...extra,
  });
}

export async function trashWithUndo(ids: string[]) {
  if (!ids.length) return;
  await trashItems(ids);
  toast(ids.length === 1 ? 'Moved to trash' : `Moved ${ids.length} items to trash`, {
    action: { label: 'Undo', run: () => void restoreItems(ids) },
  });
}

export async function archiveWithUndo(ids: string[], archived = true) {
  if (!ids.length) return;
  await Promise.all(ids.map((id) => updateItem(id, { archived })));
  toast(archived ? (ids.length === 1 ? 'Archived' : `Archived ${ids.length} items`) : 'Unarchived', {
    action: { label: 'Undo', run: () => void Promise.all(ids.map((id) => updateItem(id, { archived: !archived }))) },
  });
}

/**
 * Marks a task done or reopens it. Finishing a recurring task schedules the
 * next one as a new item and leaves this one done, so history is kept.
 */
export async function setDone(item: Item, done: boolean) {
  const now = Date.now();
  if (!done) {
    await updateItem(item.id, { status: 'todo', completedAt: null });
    return;
  }
  await updateItem(item.id, { status: 'done', completedAt: now });
  if (item.recurrence && item.due !== null) {
    const next = nextOccurrence(item.due, item.recurrence, now);
    const copy = { ...item } as Partial<Item>;
    delete copy.id;
    await addItem({
      ...copy,
      status: 'todo',
      completedAt: null,
      due: next,
      remindAt: item.remindAt !== null ? next - (item.due - item.remindAt) : null,
      checklist: item.checklist.map((c) => ({ ...c, done: false })),
      createdAt: now,
      updatedAt: now,
    });
    toast(`Next one scheduled`);
  }
}

/** The first repeat of `due` that lands after today, so an overdue series doesn't pile up. */
export function nextOccurrence(due: number, r: NonNullable<Item['recurrence']>, now = Date.now()): number {
  const step = (d: Date): Date => {
    const n = Math.max(1, r.interval);
    if (r.freq === 'daily') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
    if (r.freq === 'weekly') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n, d.getHours(), d.getMinutes());
    // Monthly on the 31st falls back to the month's last day instead of spilling over.
    const target = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes());
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(new Date(due).getDate(), last));
    return target;
  };
  const today = new Date(now);
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
  let d = step(new Date(due));
  for (let i = 0; i < 1000 && d.getTime() < endOfToday; i++) d = step(d);
  return d.getTime();
}

export async function duplicateItem(item: Item): Promise<Item> {
  const now = Date.now();
  const copy = { ...item } as Partial<Item>;
  delete copy.id;
  const created = await addItem({ ...copy, title: item.title ? `${item.title} (copy)` : '', createdAt: now, updatedAt: now });
  const files = await db.files.where('itemId').equals(item.id).toArray();
  await db.files.bulkAdd(files.map((f) => ({ ...f, id: crypto.randomUUID(), itemId: created.id })));
  return created;
}
