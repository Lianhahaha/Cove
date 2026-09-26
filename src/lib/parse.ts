import type { Priority } from './types';
import { normalizeTag } from './repo';

/** Parts of the quick-add syntax the user can switch off for one entry. */
export type ParsePart = 'due' | 'priority' | 'space' | 'tags';

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

const PREFIX = String.raw`(?:(?:due|by|on|this)\s+)?`;
const MONTH_RE = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;

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

function parseDate(text: string, now: Date): { date: Date; span: Match } | null {
  const today = startOfDay(now);
  const rules: [RegExp, (m: RegExpExecArray) => Date | null][] = [
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
      new RegExp(String.raw`(?:^|\s)((?:due|by|on|this|next)\s+)?(next\s+)?(${Object.keys(DAYS).join('|')})\b`, 'i'),
      (m) => {
        const lead = (m[1] ?? '').trim().toLowerCase();
        const word = m[3].toLowerCase();
        if (AMBIGUOUS_DAYS.has(word) && !lead && !m[2]) return null;
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
    ],
    [
      new RegExp(String.raw`(?:^|\s)${PREFIX}(\d{1,2})(?:st|nd|rd|th)?\s+${MONTH_RE}(?:\s+(\d{4}))?\b`, 'i'),
      (m) => {
        const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
        const y = fullYear(m[3], now);
        return y ? makeDate(y, month, Number(m[1])) : upcoming(now, month, Number(m[1]));
      },
    ],
    [
      new RegExp(String.raw`(?:^|\s)${PREFIX}(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b`),
      (m) => {
        const month = Number(m[1]) - 1;
        const y = fullYear(m[3], now);
        return y ? makeDate(y, month, Number(m[2])) : upcoming(now, month, Number(m[2]));
      },
    ],
  ];

  for (const [re, toDate] of rules) {
    // A rule can match text it then rejects (like "sat" with no lead-in), so keep looking past it.
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = global.exec(text))) {
      const date = toDate(m);
      if (date) {
        const lead = m[0].length - m[0].trimStart().length;
        return { date, span: { start: m.index + lead, end: m.index + m[0].length, text: m[0].trim() } };
      }
      if (global.lastIndex === m.index) global.lastIndex++;
    }
  }
  return null;
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
  if (!ignore.has('due')) {
    const date = parseDate(text, now);
    if (date) text = cut(text, date.span);
    const time = parseTime(text);
    if (time) text = cut(text, time.span);

    if (date || time) {
      let d = date ? date.date : startOfDay(now);
      if (time) {
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate(), time.h, time.min);
        // A time with no date that has already passed today means tomorrow.
        if (!date && d.getTime() <= now.getTime()) d = new Date(d.getTime() + 86_400_000);
      }
      due = d.getTime();
      dueHasTime = !!time;
      dueText = [date?.span.text, time?.span.text].filter(Boolean).join(' ');
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
    isTask: explicitTask || due !== null || priority > 0,
  };
}
