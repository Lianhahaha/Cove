import type { Item } from './types';
import { displayTitle } from './queries';

/** Escapes text per RFC 5545: backslash, semicolon, comma and newlines. */
export function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds lines longer than 75 octets, continuing with a leading space. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    // The first line holds 75 octets; continuation lines 74 plus the leading space.
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const pad = (n: number) => String(n).padStart(2, '0');
const utcStamp = (ts: number) => {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const localDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};

const RRULE: Record<string, string> = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY' };

function event(item: Item, now: number): string[] {
  if (item.due === null) return [];
  const lines = ['BEGIN:VEVENT', `UID:${item.id}@cove`, `DTSTAMP:${utcStamp(now)}`];
  if (item.dueHasTime) {
    lines.push(`DTSTART:${utcStamp(item.due)}`, `DTEND:${utcStamp(item.due + 30 * 60_000)}`);
  } else {
    // The next calendar day, not 24 hours on: across a clock change that lands on the same date.
    const d = new Date(item.due);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    lines.push(`DTSTART;VALUE=DATE:${localDate(item.due)}`, `DTEND;VALUE=DATE:${localDate(end)}`);
  }
  lines.push(`SUMMARY:${icsText(displayTitle(item))}`);
  const desc = [item.url, item.private ? '' : item.body].filter(Boolean).join('\n\n').slice(0, 2000);
  if (desc) lines.push(`DESCRIPTION:${icsText(desc)}`);
  if (item.url) lines.push(`URL:${item.url}`);
  if (item.recurrence) lines.push(`RRULE:FREQ=${RRULE[item.recurrence.freq]};INTERVAL=${item.recurrence.interval}`);
  if (item.status === 'done') lines.push('STATUS:CANCELLED');
  // Alert at the reminder time if set, otherwise an hour before timed tasks and 9am on the day for dated ones.
  const trigger = item.remindAt !== null ? `TRIGGER;VALUE=DATE-TIME:${utcStamp(item.remindAt)}` : item.dueHasTime ? 'TRIGGER:-PT1H' : 'TRIGGER:PT9H';
  lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(displayTitle(item))}`, trigger, 'END:VALARM');
  lines.push('END:VEVENT');
  return lines;
}

export function toIcs(items: Item[], now = Date.now()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cove//Cove Tasks//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Cove deadlines'];
  for (const item of items) lines.push(...event(item, now));
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function downloadIcs(items: Item[], name: string) {
  const blob = new Blob([toIcs(items)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) + '.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
