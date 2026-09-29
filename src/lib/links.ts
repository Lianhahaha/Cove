import { signal } from '@preact/signals';
import { getSetting, setSetting, uid } from './repo';
import { hostOf } from './queries';

/** A one-tap shortcut on Home to a site students open every day. */
export interface QuickLink {
  id: string;
  name: string;
  url: string;
  /** The site's own icon, fetched once when the link is added. Well-known apps use bundled logos instead. */
  icon?: string;
  /** The name came from the address, not the user, so the site's own name may replace it. */
  autoName?: boolean;
}

/** Official logos shipped with the app, so these tiles look right offline and never wait on a fetch. */
export const BRAND_LOGOS: Record<string, string> = {
  'classroom.google.com': '/brand/classroom.png',
  'mail.google.com': '/brand/gmail.png',
  'drive.google.com': '/brand/drive.png',
  'meet.google.com': '/brand/meet.png',
  'docs.google.com': '/brand/docs.png',
};

export const logoFor = (link: Pick<QuickLink, 'url' | 'icon'>): string | undefined => BRAND_LOGOS[hostOf(link.url)] ?? link.icon;

export const QUICK_LINK_LIMITS = { count: 12, nameChars: 40 } as const;

/** `name` is the short tile label; `full` names it in the Add dialog. */
export const LINK_PRESETS: (Omit<QuickLink, 'id'> & { full: string })[] = [
  { name: 'Classroom', full: 'Google Classroom', url: 'https://classroom.google.com/' },
  { name: 'Drive', full: 'Google Drive', url: 'https://drive.google.com/' },
  { name: 'Gmail', full: 'Gmail', url: 'https://mail.google.com/' },
  { name: 'Meet', full: 'Google Meet', url: 'https://meet.google.com/' },
  { name: 'Docs', full: 'Google Docs', url: 'https://docs.google.com/' },
];

/** New installs start with Classroom and Gmail; removing one sticks, because the saved list then exists. */
const DEFAULT_LINKS: QuickLink[] = [
  { id: 'classroom', name: LINK_PRESETS[0].name, url: LINK_PRESETS[0].url },
  { id: 'gmail', name: LINK_PRESETS[2].name, url: LINK_PRESETS[2].url },
];

/**
 * Turns a typed address into a clean http(s) URL, or null. "classroom.google.com"
 * gets https added; javascript:, data: and other schemes are refused.
 */
export function toWebUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v || v.length > 2048) return null;
  // Browsers turn a space in a host into %20 instead of refusing it, and "exa mple.com" is no address.
  if (/\s/.test(v.replace(/^[a-z][a-z\d+.-]*:\/\//i, '').split(/[/?#]/)[0])) return null;
  // "localhost:5173" is a host and port, not a scheme: a scheme's colon is never followed by a digit.
  const hasScheme = /^[a-z][a-z\d+.-]*:(?!\d)/i.test(v);
  try {
    const u = new URL(hasScheme ? v : `https://${v}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    // A bare word like "hello" isn't an address, but "http://intranet/wiki" typed in full is.
    if (!hasScheme && !u.hostname.includes('.') && u.hostname !== 'localhost') return null;
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
    .map((l) => ({
      id: l.id,
      name: l.name.slice(0, QUICK_LINK_LIMITS.nameChars),
      url: toWebUrl(l.url) ?? '',
      icon: typeof l.icon === 'string' ? (toWebUrl(l.icon) ?? undefined) : undefined,
      autoName: l.autoName === true || undefined,
    }))
    .filter((l) => l.url)
    .slice(0, QUICK_LINK_LIMITS.count);
}

export async function loadQuickLinks() {
  quickLinks.value = sanitize(await getSetting<unknown>('quickLinks', DEFAULT_LINKS));
  // Links added offline get their icon and name the next time the app starts online.
  for (const l of quickLinks.value) if (!logoFor(l) || l.autoName) void fetchSiteInfo(l.id, l.url);
}

/**
 * A tile label from the address when the user gives none: "wikipedia.org" becomes
 * "Wikipedia", and short school codes like "dlsu.edu.ph" become "DLSU".
 */
export function friendlyName(url: string): string {
  const labels = hostOf(url).split('.');
  if (labels.length < 2) return labels[0];
  const tld = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  const countrySecondLevel = labels.length >= 3 && tld.length === 2 && ['com', 'edu', 'gov', 'org', 'net', 'co', 'ac'].includes(second);
  const word = countrySecondLevel ? labels[labels.length - 3] : second;
  return word.length <= 4 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1);
}

/** Asks the preview service for the site's icon, and its name when the user gave none, and saves them. */
async function fetchSiteInfo(id: string, url: string) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    const res = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
    if (!res.ok) return;
    const data = (await res.json()) as { favicon?: unknown; siteName?: unknown; title?: unknown };
    const icon = toWebUrl(String(data.favicon ?? '')) ?? undefined;
    // Only a short site name fits a tile; a long page title keeps the name from the address.
    const siteName = [data.siteName, data.title].find((v): v is string => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 24)?.trim();
    const list = quickLinks.value.map((l) =>
      l.id !== id ? l : { ...l, icon: icon ?? l.icon, ...(l.autoName && siteName ? { name: siteName, autoName: undefined } : {}) },
    );
    if (list.some((l) => l.id === id)) await save(list);
  } catch {
    /* offline or blocked: the tile keeps its globe and name */
  }
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
  const typed = name.trim().slice(0, QUICK_LINK_LIMITS.nameChars);
  const id = uid();
  await save([...quickLinks.value, { id, name: typed || friendlyName(url), url, autoName: !typed || undefined }]);
  if (!BRAND_LOGOS[hostOf(url)]) void fetchSiteInfo(id, url);
  return null;
}

/** Adds links from a backup that aren't here yet, up to the limit. */
export async function mergeQuickLinks(incoming: unknown): Promise<void> {
  if (!Array.isArray(incoming)) return;
  const current = sanitize(await getSetting<unknown>('quickLinks', DEFAULT_LINKS));
  const urls = new Set(current.map((l) => l.url));
  const ids = new Set(current.map((l) => l.id));
  const added = sanitize(incoming)
    .filter((l) => !urls.has(l.url) && (urls.add(l.url), true))
    .map((l) => (ids.has(l.id) ? { ...l, id: uid() } : l));
  if (added.length) await save([...current, ...added].slice(0, QUICK_LINK_LIMITS.count));
}

/** Moves a link one place left (-1) or right (1) on Home. */
export async function moveQuickLink(id: string, delta: -1 | 1) {
  const list = [...quickLinks.value];
  const from = list.findIndex((l) => l.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return;
  [list[from], list[to]] = [list[to], list[from]];
  await save(list);
}

/** Removes a link and returns a function that puts it back where it was. */
export async function removeQuickLink(id: string): Promise<() => Promise<void>> {
  const index = quickLinks.value.findIndex((l) => l.id === id);
  const link = quickLinks.value[index];
  await save(quickLinks.value.filter((l) => l.id !== id));
  return async () => {
    if (!link || quickLinks.value.some((l) => l.url === link.url)) return;
    const list = [...quickLinks.value];
    list.splice(Math.min(index, list.length), 0, link);
    await save(list.slice(0, QUICK_LINK_LIMITS.count));
  };
}
