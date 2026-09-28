const DAY = 86_400_000;

export const startOfDay = (d: Date | number) => {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
};
export const addDays = (d: Date | number, n: number) => {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate() + n, x.getHours(), x.getMinutes());
};
export const sameDay = (a: Date | number, b: Date | number) => startOfDay(a).getTime() === startOfDay(b).getTime();

export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';

export const BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'Next 7 days',
  later: 'Later',
  none: 'No date',
};

export function dueBucket(due: number | null, hasTime: boolean, now = new Date()): DueBucket {
  if (due === null) return 'none';
  const today = startOfDay(now);
  // Day boundaries come from the calendar, not 24-hour steps, which drift an hour across a clock change.
  const dayStart = (n: number) => addDays(today, n).getTime();
  // A timed task is overdue once its time passes; a dated one only after its day ends.
  if (hasTime ? due < now.getTime() : due < today.getTime()) return 'overdue';
  if (due < dayStart(1)) return 'today';
  if (due < dayStart(2)) return 'tomorrow';
  if (due < dayStart(8)) return 'week';
  return 'later';
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const fullFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function formatDue(due: number, hasTime: boolean, now = new Date()): string {
  const d = new Date(due);
  // Intl throws on invalid dates; never let one bad record break a whole list.
  if (Number.isNaN(d.getTime())) return '';
  const today = startOfDay(now).getTime();
  const dayDiff = Math.round((startOfDay(d).getTime() - today) / DAY);
  let label: string;
  if (dayDiff === 0) label = 'Today';
  else if (dayDiff === 1) label = 'Tomorrow';
  else if (dayDiff === -1) label = 'Yesterday';
  else if (dayDiff > 1 && dayDiff < 7) label = weekdayFmt.format(d);
  else if (d.getFullYear() === now.getFullYear()) label = monthDayFmt.format(d);
  else label = fullFmt.format(d);
  return hasTime ? `${label} ${timeFmt.format(d)}` : label;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.round((ts - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 7 * 86_400) return rtf.format(Math.round(s / 86_400), 'day');
  return fullFmt.format(new Date(ts));
}

/** Value for <input type="date">. */
export const toDateInput = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Value for <input type="time">. */
export const toTimeInput = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export function fromInputs(date: string, time: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [h, min] = time ? time.split(':').map(Number) : [0, 0];
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h, min).getTime();
}
