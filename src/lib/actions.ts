import { db } from './db';
import { addItem, purgeItems, restoreItems, trashItems, updateItem } from './repo';
import { toast } from './toast';
import type { Item } from './types';
import type { Parsed } from './parse';
import { autoTagsFor } from './autotag';
import { moveReminder } from './reminders';
import { toTimeInput } from './dates';
import { signal } from '@preact/signals';

/** Mirrors the "Tag links by site" setting. */
export const autoTagEnabled = signal(true);

/** Creates an item from parsed quick-add text. */
export async function createFromParsed(p: Parsed, extra: Partial<Item> = {}): Promise<Item> {
  return addItem({
    kind: p.kind,
    title: p.title,
    url: p.url,
    // Links wait in the preview queue until the app is online.
    preview: p.url ? { status: 'pending' } : null,
    tags: autoTagEnabled.value ? [...p.tags, ...autoTagsFor(p.url)] : p.tags,
    priority: p.priority,
    spaceId: p.spaceId,
    due: p.due,
    dueHasTime: p.dueHasTime,
    recurrence: p.recurrence,
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
  // Work from the stored record: the caller's copy may be stale after a quick double click.
  const current = await db.items.get(item.id);
  if (!current) return;

  if (!done) {
    if (current.status !== 'done') return;
    await updateItem(current.id, { status: 'todo', completedAt: null, nextId: null });
    // Reopening takes back the repeat it scheduled, unless that one has been touched since.
    if (current.nextId) {
      const next = await db.items.get(current.nextId);
      if (next && next.status !== 'done' && !next.deletedAt && next.updatedAt === next.createdAt) await purgeItems([next.id]);
    }
    return;
  }

  if (current.status === 'done') return;
  let nextId: string | null = null;
  if (current.recurrence && current.due !== null) {
    const due = nextOccurrence(current.due, current.recurrence, now);
    const copy = { ...current } as Partial<Item>;
    delete copy.id;
    const created = await addItem({
      ...copy,
      // The series keeps the time it started with, even if this repeat's time was shifted.
      recurrence: current.dueHasTime ? { ...current.recurrence, time: current.recurrence.time ?? toTimeInput(current.due) } : current.recurrence,
      status: 'todo',
      completedAt: null,
      nextId: null,
      due,
      remindAt: current.remindAt !== null ? due - (current.due - current.remindAt) : null,
      checklist: current.checklist.map((c) => ({ ...c, done: false })),
      focusMins: 0,
      createdAt: now,
      updatedAt: now,
    });
    nextId = created.id;
    toast(`Next one scheduled`);
  }
  await updateItem(current.id, { status: 'done', completedAt: now, nextId });
}

/** The first repeat of `due` that lands after today, so an overdue series doesn't pile up. */
export function nextOccurrence(due: number, r: NonNullable<Item['recurrence']>, now = Date.now()): number {
  // The time of day always comes from the original due, so a repeat that lands in a
  // clock change's missing hour (2:30 becomes 3:30) doesn't stay an hour late after it.
  const first = new Date(due);
  const [h, min] = r.time ? r.time.split(':').map(Number) : [first.getHours(), first.getMinutes()];
  const step = (d: Date): Date => {
    const n = Math.max(1, r.interval);
    if (r.freq === 'daily') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, h, min);
    if (r.freq === 'weekly') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n, h, min);
    // Monthly on the 31st falls back to the month's last day instead of spilling over.
    const target = new Date(d.getFullYear(), d.getMonth() + n, 1, h, min);
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

type Schedule = Pick<Item, 'id' | 'due' | 'remindAt'>;

/**
 * Moves overdue tasks to today, keeping their time of day. A timed task whose
 * hour has already passed goes to tomorrow instead, so it isn't overdue again
 * straight away. Reminders keep their distance from the due time, unless that
 * time has already passed today, when they're dropped. Returns the
 * old schedules so the move can be undone.
 */
export async function rescheduleToToday(items: Item[], now = new Date()): Promise<Schedule[]> {
  const before: Schedule[] = [];
  for (const item of items) {
    if (item.due === null) continue;
    const old = new Date(item.due);
    let due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), item.dueHasTime ? old.getHours() : 0, item.dueHasTime ? old.getMinutes() : 0);
    if (item.dueHasTime && due.getTime() <= now.getTime()) due = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1, due.getHours(), due.getMinutes());
    before.push({ id: item.id, due: item.due, remindAt: item.remindAt });
    const remindAt = moveReminder(item.remindAt, item, { due: due.getTime(), dueHasTime: item.dueHasTime });
    // A reminder that would now be earlier today has missed its moment; kept, it would fire at once.
    await updateItem(item.id, { due: due.getTime(), remindAt: remindAt !== null && remindAt <= now.getTime() ? null : remindAt });
  }
  return before;
}

export async function restoreSchedules(schedules: Schedule[]): Promise<void> {
  await Promise.all(schedules.map(({ id, due, remindAt }) => updateItem(id, { due, remindAt })));
}

export async function duplicateItem(item: Item): Promise<Item> {
  const now = Date.now();
  const copy = { ...item } as Partial<Item>;
  delete copy.id;
  const created = await addItem({
    ...copy,
    title: item.title ? `${item.title} (copy)` : '',
    // The repeat and the focus time belong to the original. Sharing the repeat's id
    // would let reopening the copy delete the original's next task.
    nextId: null,
    focusMins: 0,
    createdAt: now,
    updatedAt: now,
  });
  const files = await db.files.where('itemId').equals(item.id).toArray();
  await db.files.bulkAdd(files.map((f) => ({ ...f, id: crypto.randomUUID(), itemId: created.id })));
  return created;
}
