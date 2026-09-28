import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { addItem } from './repo';
import { duplicateItem, nextOccurrence, setDone } from './actions';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe('nextOccurrence', () => {
  const now = at(2026, 9, 23, 10);

  it('steps daily, weekly and monthly from the due date', () => {
    expect(nextOccurrence(at(2026, 9, 23, 17), { freq: 'daily', interval: 1 }, now)).toBe(at(2026, 9, 24, 17));
    expect(nextOccurrence(at(2026, 9, 23), { freq: 'weekly', interval: 2 }, now)).toBe(at(2026, 10, 7));
    expect(nextOccurrence(at(2026, 9, 23), { freq: 'monthly', interval: 1 }, now)).toBe(at(2026, 10, 23));
  });

  it('skips past dates so an overdue series lands after today', () => {
    expect(nextOccurrence(at(2026, 9, 1), { freq: 'weekly', interval: 1 }, now)).toBe(at(2026, 9, 29));
  });

  it('keeps month-end dates on the last day of shorter months', () => {
    expect(nextOccurrence(at(2027, 1, 31), { freq: 'monthly', interval: 1 }, at(2027, 1, 31))).toBe(at(2027, 2, 28));
  });
});

describe('setDone', () => {
  it('schedules the next repeat as a new open task', async () => {
    const item = await addItem({
      title: 'Weekly quiz',
      status: 'todo',
      due: at(2099, 1, 5),
      recurrence: { freq: 'weekly', interval: 1 },
      checklist: [{ id: 'c', text: 'review', done: true }],
    });
    await setDone(item, true);
    const all = await db.items.toArray();
    expect(all).toHaveLength(2);
    const done = all.find((i) => i.id === item.id)!;
    const next = all.find((i) => i.id !== item.id)!;
    expect(done.status).toBe('done');
    expect(next).toMatchObject({ status: 'todo', due: at(2099, 1, 12), title: 'Weekly quiz' });
    expect(next.checklist[0].done).toBe(false);
  });

  it('reopens a task', async () => {
    const item = await addItem({ status: 'done', completedAt: 1 });
    await setDone(item, false);
    expect(await db.items.get(item.id)).toMatchObject({ status: 'todo', completedAt: null });
  });
});

describe('setDone with repeats', () => {
  const repeating = () =>
    addItem({ title: 'Weekly quiz', status: 'todo', due: at(2099, 1, 5), recurrence: { freq: 'weekly', interval: 1 } });

  it('schedules only one repeat however often it is ticked', async () => {
    const item = await repeating();
    await setDone(item, true);
    await setDone(item, true);
    await setDone(item, false);
    await setDone(item, true);
    const open = (await db.items.toArray()).filter((i) => i.status === 'todo');
    expect(open).toHaveLength(1);
    expect(open[0].due).toBe(at(2099, 1, 12));
  });

  it('takes back the scheduled repeat when reopened', async () => {
    const item = await repeating();
    await setDone(item, true);
    await setDone(item, false);
    const all = await db.items.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ status: 'todo', nextId: null });
  });

  it('keeps a repeat that was edited in the meantime', async () => {
    const item = await repeating();
    await setDone(item, true);
    const { nextId } = (await db.items.get(item.id))!;
    await new Promise((r) => setTimeout(r, 2));
    await db.items.update(nextId!, { title: 'Weekly quiz (moved room)', updatedAt: Date.now() });
    await setDone(item, false);
    expect(await db.items.get(nextId!)).toBeDefined();
  });
});

describe('duplicateItem', () => {
  it('does not share the original’s scheduled repeat', async () => {
    const item = await addItem({ title: 'Weekly quiz', status: 'todo', due: at(2099, 1, 5), recurrence: { freq: 'weekly', interval: 1 } });
    await setDone(item, true);
    const done = (await db.items.get(item.id))!;
    const copy = await duplicateItem(done);
    expect(copy.nextId).toBeNull();
    // Reopening the copy must leave the original's next task alone.
    await setDone(copy, false);
    expect(await db.items.get(done.nextId!)).toBeDefined();
  });

  it('starts the copy with no focus time', async () => {
    const item = await addItem({ title: 'Essay', focusMins: 50 });
    const copy = await duplicateItem(item);
    expect(copy.focusMins).toBe(0);
  });
});
