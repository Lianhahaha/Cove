import type { Priority, Recurrence } from './types';
import { normalizeTag } from './repo';

/** Parts of the quick-add syntax the user can switch off for one entry. */
export type ParsePart = 'due' | 'repeat' | 'priority' | 'space' | 'tags';

export interface ParseContext {
  now?: Date;
  spaces?: { id: string; name: string }[];
  ignore?: Set<ParsePart>;
}

export interface Parsed {
  kind: 'link' | 'note';
  title: string;
  url: string | null;
  tags: string[];
  priority: Priority;
  spaceId: string | null;
  due: number | null;
  dueHasTime: boolean;
  /** The text that produced the due date, for showing and undoing. */
  dueText: string | null;
  /** From "every fri", "every 2 weeks" and the like. Always comes with a due date. */
  recurrence: Recurrence | null;
  isTask: boolean;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
};
/** Short day names that are also English words need a lead-in like "due" or "on". */
const AMBIGUOUS_DAYS = new Set(['sun', 'sat', 'wed']);

/** Words that can lead into a date and are taken with it. A repeat also takes its start: "every week from oct 5". */
const leadIn = (repeat: boolean) => String.raw`(?:(?:due|by|on|this${repeat ? '|from|starting' : ''})\s+)?`;
const MONTH_RE = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;

/** A weekday name, with an optional lead-in, right before a written-out date: "due Mon, " in "due Mon, Dec 7". */
const WEEKDAY_BEFORE = new RegExp(String.raw`(?:^|\s)((?:due|by|on)\s+)?(${Object.keys(DAYS).join('|')})(\.?,?)\s*$`, 'i');

/** A written-out date straight after a weekday name, as in "Mon, Dec 7" or "fri 10/9". */
const DATE_AFTER = new RegExp(String.raw`^\.?,?\s*(?:${MONTH_RE}\s+\d|\d{1,2}(?:st|nd|rd|th)?\s+${MONTH_RE}|\d{1,2}\/\d)`, 'i');
/** A written-out date straight before a weekday name, as in "Dec 7, Mon" or "10/9 fri". */
const DATE_BEFORE = new RegExp(
  String.raw`(?:${MONTH_RE}\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}(?:st|nd|rd|th)?\s+${MONTH_RE}(?:\s+\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?),?\s*$`,
  'i',
);
/** A weekday name right after a written-out date: ", Monday" in "Dec 7, Monday". */
const WEEKDAY_AFTER = new RegExp(String.raw`^(,?)\s*(${Object.keys(DAYS).join('|')})\b\.?`, 'i');

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Builds a date, rejecting overflow like Feb 31. */
function makeDate(y: number, m: number, day: number): Date | null {
  const d = new Date(y, m, day);
  return d.getMonth() === m && d.getDate() === day ? d : null;
}

/** A date this many days back is still read as this year's (someone logging a late task). */
const RECENT_PAST_DAYS = 60;

/**
 * For dates written without a year: a date in the last two months stays in
 * this year, and anything further back means next year.
 */
function upcoming(now: Date, m: number, day: number): Date | null {
  const today = startOfDay(now);
  const d = makeDate(today.getFullYear(), m, day);
  if (!d) return null;
  const daysAgo = (today.getTime() - d.getTime()) / 86_400_000;
  return daysAgo > RECENT_PAST_DAYS ? makeDate(today.getFullYear() + 1, m, day) : d;
}

function fullYear(y: string | undefined, now: Date): number | null {
  if (!y) return null;
  const n = Number(y);
  return y.length <= 2 ? 2000 + n : n > now.getFullYear() + 50 ? null : n;
}

interface Match {
  start: number;
  end: number;
  text: string;
}

function take(text: string, re: RegExp): { m: RegExpExecArray; span: Match } | null {
  const m = re.exec(text);
  if (!m) return null;
  // Keep the leading whitespace outside the span so words don't run together.
  const lead = m[0].length - m[0].trimStart().length;
  const start = m.index + lead;
  return { m, span: { start, end: m.index + m[0].length, text: m[0].trim() } };
}

function cut(text: string, span: Match): string {
  return text.slice(0, span.start) + ' ' + text.slice(span.end);
}

function parseDate(text: string, now: Date, forRepeat = false): { date: Date; span: Match } | null {
  const today = startOfDay(now);
  const PREFIX = leadIn(forRepeat);
  // The last flag marks a written-out date, which may have its weekday in front ("Mon, Dec 7").
  const rules: [RegExp, (m: RegExpExecArray) => Date | null, boolean?][] = [
    [new RegExp(String.raw`(?:^|\s)${PREFIX}(today|ngayon|mamaya|tonight)\b`, 'i'), () => today],
    [new RegExp(String.raw`(?:^|\s)${PREFIX}(tomorrow|tmrw?|bukas)\b`, 'i'), () => addDays(today, 1)],
    [new RegExp(String.raw`(?:^|\s)${PREFIX}next\s+week\b`, 'i'), () => addDays(today, ((8 - today.getDay()) % 7) || 7)],
    [new RegExp(String.raw`(?:^|\s)${PREFIX}weekend\b`, 'i'), () => addDays(today, (6 - today.getDay() + 7) % 7)],
    [
      /(?:^|\s)(?:due\s+)?in\s+(\d{1,3})\s*(d|days?|w|wks?|weeks?|mos?|months?)\b/i,
      (m) => {
        const n = Number(m[1]);
        const unit = m[2].toLowerCase();
        if (unit.startsWith('d')) return addDays(today, n);
        if (unit.startsWith('w')) return addDays(today, n * 7);
        // Same day N months on, or that month's last day (Jan 31 + 1 month = Feb 28). Works across year ends.
        const first = new Date(today.getFullYear(), today.getMonth() + n, 1);
        const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
        return new Date(first.getFullYear(), first.getMonth(), Math.min(today.getDate(), last));
      },
    ],
    [
      new RegExp(String.raw`(?:^|\s)((?:due|by|on|this|next${forRepeat ? '|from|starting' : ''})\s+)?(next\s+)?(${Object.keys(DAYS).join('|')})\b`, 'i'),
      (m) => {
        const lead = (m[1] ?? '').trim().toLowerCase();
        const word = m[3].toLowerCase();
        if (AMBIGUOUS_DAYS.has(word) && !lead && !m[2]) return null;
        // "Mon, Dec 7" and "Dec 7, Mon" name the day of a written-out date; leave them to the date rules below.
        if (DATE_AFTER.test(text.slice(m.index + m[0].length)) || DATE_BEFORE.test(text.slice(0, m.index))) return null;
        const isNext = lead === 'next' || !!m[2];
        // "fri" is the coming Friday (today counts); "next fri" is the one a week after that.
        const diff = (DAYS[word] - today.getDay() + 7) % 7;
        return addDays(today, isNext ? (diff === 0 ? 7 : diff + 7) : diff);
      },
    ],
    [
      new RegExp(String.raw`(?:^|\s)${PREFIX}${MONTH_RE}\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b`, 'i'),
      (m) => {
        const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
        const y = fullYear(m[3], now);
        return y ? makeDate(y, month, Number(m[2])) : upcoming(now, month, Number(m[2]));
      },
      true,
    ],
    [
      new RegExp(String.raw`(?:^|\s)${PREFIX}(\d{1,2})(?:st|nd|rd|th)?\s+${MONTH_RE}(?:\s+(\d{4}))?\b`, 'i'),
      (m) => {
        const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
        const y = fullYear(m[3], now);
        return y ? makeDate(y, month, Number(m[1])) : upcoming(now, month, Number(m[1]));
      },
      true,
    ],
    [
      new RegExp(String.raw`(?:^|\s)${PREFIX}(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b`, 'i'),
      (m) => {
        const month = Number(m[1]) - 1;
        const y = fullYear(m[3], now);
        return y ? makeDate(y, month, Number(m[2])) : upcoming(now, month, Number(m[2]));
      },
      true,
    ],
  ];

  for (const [re, toDate, written] of rules) {
    // A rule can match text it then rejects (like "sat" with no lead-in), so keep looking past it.
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = global.exec(text))) {
      const date = toDate(m);
      if (date) {
        const lead = m[0].length - m[0].trimStart().length;
        let start = m.index + lead;
        let end = m.index + m[0].length;
        // A weekday written before the date goes with it, so it doesn't stay in the title.
        const day = written ? WEEKDAY_BEFORE.exec(text.slice(0, start)) : null;
        // "sun", "sat" and "wed" are words too ("fun in the sun 7/4"), so they need a lead-in or a comma.
        const isDay = day && (!AMBIGUOUS_DAYS.has(day[2].toLowerCase()) || day[1] || day[3]);
        if (day && isDay) start = day.index + day[0].length - day[0].trimStart().length;
        // The same for a weekday written after it: "Dec 7, Monday".
        const after = written ? WEEKDAY_AFTER.exec(text.slice(end)) : null;
        if (after && (!AMBIGUOUS_DAYS.has(after[2].toLowerCase()) || after[1])) end += after[0].length;
        return { date, span: { start, end, text: text.slice(start, end).trim() } };
      }
      if (global.lastIndex === m.index) global.lastIndex++;
    }
  }
  return null;
}

const REPEAT_RE = new RegExp(
  String.raw`(?:^|\s)(?:every\s+(?:(other)\s+|(\d{1,2})\s+)?(day|week|month|${Object.keys(DAYS).join('|')})s?|(araw-araw))\b`,
  'i',
);

/**
 * "every day", "every other week", "every 3 months", "every fri" or the Filipino
 * "araw-araw". A weekday also says when the series starts.
 */
function parseRepeat(text: string, now: Date): { recurrence: Recurrence; start: Date | null; span: Match } | null {
  const found = take(text, REPEAT_RE);
  if (!found) return null;
  const { m, span } = found;
  if (m[4]) return { recurrence: { freq: 'daily', interval: 1 }, start: null, span };
  const interval = m[1] ? 2 : m[2] ? Number(m[2]) : 1;
  if (interval < 1) return null;
  const unit = m[3].toLowerCase();
  if (unit in DAYS) {
    const today = startOfDay(now);
    return { recurrence: { freq: 'weekly', interval }, start: addDays(today, (DAYS[unit] - today.getDay() + 7) % 7), span };
  }
  const freq = unit === 'day' ? 'daily' : unit === 'week' ? 'weekly' : 'monthly';
  return { recurrence: { freq, interval }, start: null, span };
}

/** "in 2 hours", "in 30 mins", "in an hour" or "in half an hour": a time counted from now. */
function parseSoon(text: string): { minutes: number; span: Match } | null {
  const found = take(text, /(?:^|\s)(?:due\s+)?in\s+(\d{1,3}|an?|half\s+an?)\s*(h|hrs?|hours?|mins?|minutes?)\b/i);
  if (!found) return null;
  const [, count, unit] = found.m;
  const n = /^half/i.test(count) ? 0.5 : /^an?$/i.test(count) ? 1 : Number(count);
  const minutes = Math.round(n * (unit.toLowerCase().startsWith('h') ? 60 : 1));
  return minutes > 0 ? { minutes, span: found.span } : null;
}

/** One step of a repeat from `d`: days, weeks, or months kept on the same day where the month allows. */
function stepRepeat(d: Date, r: Recurrence, onWeekday: boolean): Date {
  if (onWeekday) return addDays(d, 7);
  if (r.freq === 'daily') return addDays(d, r.interval);
  if (r.freq === 'weekly') return addDays(d, 7 * r.interval);
  const last = new Date(d.getFullYear(), d.getMonth() + r.interval + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + r.interval, Math.min(d.getDate(), last));
}

function parseTime(text: string): { h: number; min: number; span: Match } | null {
  const ampm = take(text, /(?:^|\s)(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (ampm) {
    let h = Number(ampm.m[1]);
    if (h < 1 || h > 12) return null;
    const pm = ampm.m[3].toLowerCase() === 'pm';
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
    return { h, min: Number(ampm.m[2] ?? 0), span: ampm.span };
  }
  const h24 = take(text, /(?:^|\s)(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (h24) return { h: Number(h24.m[1]), min: Number(h24.m[2]), span: h24.span };
  const noon = take(text, /(?:^|\s)(?:at\s+)?(noon|midnight)\b/i);
  if (noon) return { h: noon.m[1].toLowerCase() === 'noon' ? 12 : 0, min: 0, span: noon.span };
  return null;
}

/**
 * A bare address like "donghuafun.com" or "portal.myschool.edu.ph/login". Only common
 * web endings count, so file names (notes.md, main.py), emails and "Ch.4" stay text.
 */
const BARE_DOMAIN =
  /(?<![@\w./-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|org|net|edu|gov|io|co|dev|app|ph|me|info|ai|tv|us|uk|ca|au|sg|site|online|tech|page|gg|xyz)(?![\w-])(?::\d{2,5})?(?:[/?#][^\s<>"']*)?/i;

function extractUrl(text: string): { url: string; rest: string } | null {
  const m = /(?:https?:\/\/|www\.)[^\s<>"']+/i.exec(text) ?? BARE_DOMAIN.exec(text);
  if (!m) return null;
  let url = m[0];
  // Drop punctuation that ends a sentence rather than the URL, keeping balanced parens.
  while (/[.,;:!?'"\]]$/.test(url) || (url.endsWith(')') && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0))) {
    url = url.slice(0, -1);
  }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return { url, rest: text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length) };
}

const squash = (s: string) => s.replace(/[^\S\n]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
const spaceKey = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');

export function parseQuickAdd(input: string, ctx: ParseContext = {}): Parsed {
  const now = ctx.now ?? new Date();
  const ignore = ctx.ignore ?? new Set<ParsePart>();
  let text = input;

  let explicitTask = false;
  const todo = /^\s*(?:\[\s?\]|todo:?|task:)\s+/i.exec(text);
  if (todo) {
    explicitTask = true;
    text = text.slice(todo[0].length);
  }

  const link = extractUrl(text);
  let url: string | null = null;
  if (link) {
    url = link.url;
    text = link.rest;
  }

  const tags: string[] = [];
  if (!ignore.has('tags')) {
    text = text.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_all, lead: string, tag: string) => {
      const t = normalizeTag(tag);
      if (t && !tags.includes(t)) tags.push(t);
      return lead;
    });
  }

  let priority: Priority = 0;
  if (!ignore.has('priority')) {
    const p = take(text, /(?:^|\s)(!{1,3}|![123])(?=\s|$)/);
    if (p) {
      const tok = p.m[1];
      priority = (/\d/.test(tok) ? Number(tok[1]) : tok.length) as Priority;
      text = cut(text, p.span);
    }
  }

  let spaceId: string | null = null;
  if (!ignore.has('space') && ctx.spaces?.length) {
    const re = /(^|\s)@([\p{L}\p{N}_-]+)/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const key = spaceKey(m[2]);
      const space = ctx.spaces.find((s) => spaceKey(s.name) === key) ?? ctx.spaces.find((s) => spaceKey(s.name).startsWith(key));
      if (space) {
        spaceId = space.id;
        const start = m.index + m[1].length;
        text = cut(text, { start, end: start + m[2].length + 1, text: m[0] });
        break;
      }
    }
  }

  let due: number | null = null;
  let dueHasTime = false;
  let dueText: string | null = null;
  let recurrence: Recurrence | null = null;
  // A repeat is part of the schedule, so switching off the due date leaves its words in the title too.
  if (!ignore.has('due')) {
    // Read before dates, so the "fri" in "every fri" isn't taken as a one-off date.
    const repeat = ignore.has('repeat') ? null : parseRepeat(text, now);
    if (repeat) text = cut(text, repeat.span);
    // "in 2 hours" sets the date and time at once, so nothing else is read after it.
    const soon = parseSoon(text);
    if (soon) text = cut(text, soon.span);
    const date = soon ? null : parseDate(text, now, !!repeat);
    if (date) text = cut(text, date.span);
    const time = soon ? null : parseTime(text);
    if (time) text = cut(text, time.span);

    if (date || time || repeat || soon) {
      // A repeat with no date starts on its weekday, or today.
      let d = date?.date ?? repeat?.start ?? startOfDay(now);
      // To the minute, so "in 2 hours" typed at 10:00:40 reads 12:00.
      if (soon) d = new Date(Math.floor((now.getTime() + soon.minutes * 60_000) / 60_000) * 60_000);
      if (time) {
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate(), time.h, time.min);
        // A time with no date that has already passed today means tomorrow. A repeat moves on by one
        // of its own steps instead, so "every week 9am" keeps today's weekday and "every fri" stays on Fridays.
        // Built from the date, not by adding 24 hours, so a clock change overnight keeps the hour typed.
        if (!date && d.getTime() <= now.getTime()) d = repeat ? stepRepeat(d, repeat.recurrence, !!repeat.start) : addDays(d, 1);
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate(), time.h, time.min);
      }
      due = d.getTime();
      dueHasTime = !!(time || soon);
      dueText = [repeat?.span.text, soon?.span.text, date?.span.text, time?.span.text].filter(Boolean).join(' ');
      // A repeat keeps the time typed, even if the first one lands in a skipped hour and shifts.
      recurrence = repeat ? (time ? { ...repeat.recurrence, time: `${String(time.h).padStart(2, '0')}:${String(time.min).padStart(2, '0')}` } : repeat.recurrence) : null;
    }
  }

  const title = squash(text).replace(/^[-–—:,\s]+|[-–—:,\s]+$/g, '');
  return {
    kind: url ? 'link' : 'note',
    title,
    url,
    tags,
    priority,
    spaceId,
    due,
    dueHasTime,
    dueText,
    recurrence,
    isTask: explicitTask || due !== null || priority > 0,
  };
}
