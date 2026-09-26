import { signal } from '@preact/signals';
import { getSetting, setSetting, uid } from './repo';
import { hostOf } from './queries';

/** A one-tap shortcut on Home to a site students open every day. */
export interface QuickLink {
  id: string;
  name: string;
  url: string;
}

export const QUICK_LINK_LIMITS = { count: 12, nameChars: 40 } as const;

/** `name` is the short tile label; `full` names it in the Add dialog. */
export const LINK_PRESETS: (Omit<QuickLink, 'id'> & { full: string })[] = [
  { name: 'Classroom', full: 'Google Classroom', url: 'https://classroom.google.com/' },
  { name: 'Drive', full: 'Google Drive', url: 'https://drive.google.com/' },
  { name: 'Gmail', full: 'Gmail', url: 'https://mail.google.com/' },
  { name: 'Meet', full: 'Google Meet', url: 'https://meet.google.com/' },
  { name: 'Docs', full: 'Google Docs', url: 'https://docs.google.com/' },
];

/** New installs start with Classroom; removing it sticks, because the saved list then exists. */
const DEFAULT_LINKS: QuickLink[] = [{ id: 'classroom', name: LINK_PRESETS[0].name, url: LINK_PRESETS[0].url }];

/**
 * Turns a typed address into a clean http(s) URL, or null. "classroom.google.com"
 * gets https added; javascript:, data: and other schemes are refused.
 */
export function toWebUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v || v.length > 2048) return null;
  try {
    const u = new URL(/^[a-z][a-z\d+.-]*:/i.test(v) ? v : `https://${v}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.href;
  } catch {
    return null;
  }
}

export const isClassroom = (url: string) => hostOf(url) === 'classroom.google.com';

export const quickLinks = signal<QuickLink[]>(DEFAULT_LINKS);

/** Keeps only well-formed entries, so a bad saved value can't break Home. */
function sanitize(v: unknown): QuickLink[] {
  if (!Array.isArray(v)) return DEFAULT_LINKS;
  return v
    .filter((l): l is QuickLink => !!l && typeof l.id === 'string' && typeof l.name === 'string' && typeof l.url === 'string')
    .map((l) => ({ id: l.id, name: l.name.slice(0, QUICK_LINK_LIMITS.nameChars), url: toWebUrl(l.url) ?? '' }))
    .filter((l) => l.url)
    .slice(0, QUICK_LINK_LIMITS.count);
}

export async function loadQuickLinks() {
  quickLinks.value = sanitize(await getSetting<unknown>('quickLinks', DEFAULT_LINKS));
}

async function save(list: QuickLink[]) {
  quickLinks.value = list;
  await setSetting('quickLinks', list);
}

/** Adds a link, or returns why it can't be added. */
export async function addQuickLink(name: string, rawUrl: string): Promise<string | null> {
  const url = toWebUrl(rawUrl);
  if (!url) return 'That doesn’t look like a web address.';
  if (quickLinks.value.length >= QUICK_LINK_LIMITS.count) return `You can keep up to ${QUICK_LINK_LIMITS.count} quick links.`;
  if (quickLinks.value.some((l) => l.url === url)) return 'That link is already here.';
  const clean = name.trim().slice(0, QUICK_LINK_LIMITS.nameChars) || hostOf(url);
  await save([...quickLinks.value, { id: uid(), name: clean, url }]);
  return null;
}

export async function removeQuickLink(id: string) {
  await save(quickLinks.value.filter((l) => l.id !== id));
}
