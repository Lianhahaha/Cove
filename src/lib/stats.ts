import type { Item } from './types';

const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Days in a row, ending today or yesterday, with at least one finished task. */
export function streak(items: Item[], now = new Date()): number {
  const days = new Set(items.filter((i) => i.completedAt).map((i) => dayKey(i.completedAt!)));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // A streak isn't broken until today ends, so start from yesterday if today is empty.
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

/** Tasks finished on each of the last `days` days, oldest first. */
export function finishedPerDay(items: Item[], days = 14, now = new Date()): { date: Date; count: number }[] {
  const counts = new Map<string, number>();
  for (const i of items) if (i.completedAt) counts.set(dayKey(i.completedAt), (counts.get(dayKey(i.completedAt)) ?? 0) + 1);
  return Array.from({ length: days }, (_, k) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - k));
    return { date, count: counts.get(dayKey(date.getTime())) ?? 0 };
  });
}

export function sinceDays(items: Item[], field: 'createdAt' | 'completedAt', days: number, now = Date.now()): number {
  const from = now - days * 86_400_000;
  return items.filter((i) => (i[field] ?? 0) >= from).length;
}
