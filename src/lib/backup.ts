import { db } from './db';
import { LIMITS, newItem, normalizeTags, SPACE_COLORS, uid } from './repo';
import { displayTitle } from './queries';
import type { ChecklistEntry, Item, LinkPreview, Recurrence, Space, StoredFile } from './types';

export const BACKUP_FORMAT = 'cove-backup';
export const BACKUP_VERSION = 1;
/** Refuse absurd archives before unzipping them into memory. */
const MAX_BACKUP_BYTES = 1024 * 1024 * 1024;
const MAX_RECORDS = 100_000;

interface BackupFileMeta {
  id: string;
  itemId: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  path: string;
}

interface BackupJson {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  spaces: Space[];
  items: Item[];
  files: BackupFileMeta[];
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'untitled';

export async function exportBackup(): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate');
  const [spaces, items, files] = await Promise.all([db.spaces.toArray(), db.items.toArray(), db.files.toArray()]);
  const entries: Record<string, Uint8Array> = {};
  const fileMeta: BackupFileMeta[] = [];
  for (const f of files) {
    const path = `files/${f.id}-${safeName(f.name)}`;
    entries[path] = new Uint8Array(await f.blob.arrayBuffer());
    fileMeta.push({ id: f.id, itemId: f.itemId, name: f.name, type: f.type, size: f.size, createdAt: f.createdAt, path });
  }
  const json: BackupJson = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: Date.now(), spaces, items, files: fileMeta };
  entries['cove-backup.json'] = strToU8(JSON.stringify(json));
  // Files are usually already compressed (PDF, JPG), so store them as-is and only compress the JSON.
  const zipped = zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, [v, { level: k.endsWith('.json') ? 6 : 0 }]])));
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}

// ─── Validation: a backup is untrusted input, so every field is checked ────

const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.slice(0, max) : fallback);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bool = (v: unknown) => v === true;
const isId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
const httpUrl = (v: unknown) => (typeof v === 'string' && /^https?:\/\//i.test(v) && v.length <= 2048 ? v : null);

function toPreview(v: unknown): LinkPreview | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const status = p.status === 'ok' || p.status === 'error' ? p.status : 'pending';
  return {
    status,
    title: str(p.title, 300) || undefined,
    description: str(p.description, 500) || undefined,
    image: httpUrl(p.image) ?? undefined,
    siteName: str(p.siteName, 100) || undefined,
    favicon: httpUrl(p.favicon) ?? undefined,
    fetchedAt: num(p.fetchedAt) ?? undefined,
  };
}

function toChecklist(v: unknown): ChecklistEntry[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, LIMITS.checklistEntries)
    .filter((c) => c && typeof c === 'object')
    .map((c) => ({ id: isId(c.id) ? c.id : uid(), text: str(c.text, 300), done: bool(c.done) }));
}

function toRecurrence(v: unknown): Recurrence | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (r.freq !== 'daily' && r.freq !== 'weekly' && r.freq !== 'monthly') return null;
  return { freq: r.freq, interval: Math.min(99, Math.max(1, Math.round(num(r.interval) ?? 1))) };
}

export function toItem(v: unknown): Item | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (!isId(r.id)) return null;
  const kind = r.kind === 'link' || r.kind === 'file' ? r.kind : 'note';
  const status = r.status === 'todo' || r.status === 'doing' || r.status === 'done' ? r.status : 'none';
  const priority = [0, 1, 2, 3].includes(r.priority as number) ? (r.priority as Item['priority']) : 0;
  const now = Date.now();
  return newItem({
    id: r.id,
    kind,
    title: str(r.title, LIMITS.titleChars),
    body: str(r.body, LIMITS.bodyChars),
    url: httpUrl(r.url),
    preview: toPreview(r.preview),
    spaceId: isId(r.spaceId) ? r.spaceId : null,
    tags: normalizeTags(Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : []),
    pinned: bool(r.pinned),
    favorite: bool(r.favorite),
    archived: bool(r.archived),
    private: bool(r.private),
    status,
    due: num(r.due),
    dueHasTime: bool(r.dueHasTime),
    priority,
    checklist: toChecklist(r.checklist),
    recurrence: toRecurrence(r.recurrence),
    remindAt: num(r.remindAt),
    estimateMins: num(r.estimateMins),
    completedAt: num(r.completedAt),
    focusMins: Math.max(0, Math.round(num(r.focusMins) ?? 0)),
    nextId: isId(r.nextId) ? r.nextId : null,
    order: num(r.order) ?? now,
    createdAt: num(r.createdAt) ?? now,
    updatedAt: num(r.updatedAt) ?? now,
    deletedAt: num(r.deletedAt),
  });
}

export function toSpace(v: unknown): Space | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (!isId(r.id)) return null;
  const now = Date.now();
  return {
    id: r.id,
    name: str(r.name, LIMITS.spaceNameChars).trim() || 'Untitled',
    emoji: str(r.emoji, 8) || '📘',
    color: typeof r.color === 'string' && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : SPACE_COLORS[0],
    order: num(r.order) ?? 0,
    archived: bool(r.archived),
    aiExcluded: bool(r.aiExcluded),
    createdAt: num(r.createdAt) ?? now,
    updatedAt: num(r.updatedAt) ?? now,
    deletedAt: num(r.deletedAt),
  };
}

export interface ImportResult {
  items: number;
  spaces: number;
  files: number;
  skipped: number;
}

/**
 * Merges a backup into the database. A record replaces the local copy only
 * when it was edited more recently, so importing an old backup never undoes
 * newer work.
 */
export async function importBackup(file: Blob): Promise<ImportResult> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('That backup is too large to import.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let json: unknown;
  let archive: Record<string, Uint8Array> = {};
  // Zip files start with "PK".
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const { unzipSync, strFromU8 } = await import('fflate');
    archive = unzipSync(bytes);
    const data = archive['cove-backup.json'];
    if (!data) throw new Error('This zip isn’t a Cove backup.');
    json = JSON.parse(strFromU8(data));
  } else {
    json = JSON.parse(new TextDecoder().decode(bytes));
  }

  const b = json as Partial<BackupJson>;
  if (!b || b.format !== BACKUP_FORMAT) throw new Error('This file isn’t a Cove backup.');
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) throw new Error('This backup is from a newer version of Cove. Update the app first.');

  const rawItems = Array.isArray(b.items) ? b.items.slice(0, MAX_RECORDS) : [];
  const rawSpaces = Array.isArray(b.spaces) ? b.spaces.slice(0, MAX_RECORDS) : [];
  const items = rawItems.map(toItem).filter((i): i is Item => !!i);
  const spaces = rawSpaces.map(toSpace).filter((s): s is Space => !!s);
  const result: ImportResult = { items: 0, spaces: 0, files: 0, skipped: rawItems.length - items.length + rawSpaces.length - spaces.length };

  await db.transaction('rw', db.items, db.spaces, db.files, async () => {
    const localSpaces = new Map((await db.spaces.bulkGet(spaces.map((s) => s.id))).filter(Boolean).map((s) => [s!.id, s!]));
    const newerSpaces = spaces.filter((s) => (localSpaces.get(s.id)?.updatedAt ?? -1) < s.updatedAt);
    await db.spaces.bulkPut(newerSpaces);
    result.spaces = newerSpaces.length;

    const localItems = new Map((await db.items.bulkGet(items.map((i) => i.id))).filter(Boolean).map((i) => [i!.id, i!]));
    const newerItems = items.filter((i) => (localItems.get(i.id)?.updatedAt ?? -1) < i.updatedAt);
    await db.items.bulkPut(newerItems);
    result.items = newerItems.length;

    const knownItems = new Set([...localItems.keys(), ...items.map((i) => i.id)]);
    for (const m of Array.isArray(b.files) ? b.files.slice(0, MAX_RECORDS) : []) {
      if (!m || !isId(m.id) || !isId(m.itemId) || !knownItems.has(m.itemId) || typeof m.path !== 'string') continue;
      const data = archive[m.path];
      if (!data || data.length > LIMITS.fileBytes || (await db.files.get(m.id))) continue;
      const type = str(m.type, 100, 'application/octet-stream');
      const rec: StoredFile = {
        id: m.id,
        itemId: m.itemId,
        name: str(m.name, 200, 'file'),
        type,
        size: data.length,
        blob: new Blob([data as BlobPart], { type }),
        createdAt: num(m.createdAt) ?? Date.now(),
      };
      await db.files.add(rec);
      result.files++;
    }
  });
  return result;
}

// ─── Markdown export ───────────────────────────────────────────────────

const yaml = (s: string) => JSON.stringify(s);

export function itemToMarkdown(item: Item, spaceName: string | null): string {
  const lines = ['---', `title: ${yaml(displayTitle(item))}`];
  if (item.url) lines.push(`url: ${yaml(item.url)}`);
  if (spaceName) lines.push(`space: ${yaml(spaceName)}`);
  if (item.tags.length) lines.push(`tags: [${item.tags.map(yaml).join(', ')}]`);
  if (item.status !== 'none') lines.push(`status: ${item.status}`);
  if (item.due !== null) lines.push(`due: ${new Date(item.due).toISOString()}`);
  if (item.priority) lines.push(`priority: ${item.priority}`);
  lines.push(`created: ${new Date(item.createdAt).toISOString()}`, `updated: ${new Date(item.updatedAt).toISOString()}`, '---', '');
  lines.push(`# ${displayTitle(item)}`, '');
  if (item.url) lines.push(`<${item.url}>`, '');
  if (item.preview?.description) lines.push(`> ${item.preview.description}`, '');
  if (item.body) lines.push(item.body, '');
  if (item.checklist.length) lines.push(...item.checklist.map((c) => `- [${c.done ? 'x' : ' '}] ${c.text}`), '');
  return lines.join('\n');
}

export async function exportMarkdown(): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate');
  const [spaces, items, files] = await Promise.all([db.spaces.toArray(), db.items.filter((i) => !i.deletedAt).toArray(), db.files.toArray()]);
  const spaceName = new Map(spaces.map((s) => [s.id, s.name]));
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  const used = new Set<string>();
  const unique = (path: string) => {
    let p = path;
    for (let n = 2; used.has(p.toLowerCase()); n++) p = path.replace(/(\.[^.]+)?$/, ` (${n})$1`);
    used.add(p.toLowerCase());
    return p;
  };
  for (const item of items) {
    const folder = safeName(item.spaceId ? spaceName.get(item.spaceId) ?? 'Inbox' : 'Inbox');
    const base = safeName(displayTitle(item)).slice(0, 80);
    entries[unique(`${folder}/${base}.md`)] = [strToU8(itemToMarkdown(item, item.spaceId ? spaceName.get(item.spaceId) ?? null : null)), { level: 6 }];
    for (const f of files.filter((x) => x.itemId === item.id)) {
      entries[unique(`${folder}/${base} files/${safeName(f.name)}`)] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
    }
  }
  return new Blob([zipSync(entries) as BlobPart], { type: 'application/zip' });
}

// ─── Browser bookmarks ─────────────────────────────────────────────────

export interface Bookmark {
  url: string;
  title: string;
  folder: string | null;
  addedAt: number | null;
}

/** Reads the Netscape bookmark HTML that every browser exports. */
export function parseBookmarksHtml(html: string): Bookmark[] {
  const out: Bookmark[] = [];
  const folders: string[] = [];
  // Walk tags in order: <H3> opens a folder name, </DL> closes the deepest one.
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>|<a\s([^>]*)>([\s\S]*?)<\/a>|<\/dl>/gi;
  for (const m of html.matchAll(re)) {
    if (m[1] !== undefined) {
      folders.push(decode(m[1]));
    } else if (m[2] !== undefined) {
      const href = /href\s*=\s*"([^"]*)"/i.exec(m[2])?.[1];
      const added = /add_date\s*=\s*"(\d+)"/i.exec(m[2])?.[1];
      const url = href ? httpUrl(decode(href)) : null;
      if (url) out.push({ url, title: decode(m[3]).slice(0, LIMITS.titleChars), folder: folders.at(-1) ?? null, addedAt: added ? Number(added) * 1000 : null });
    } else {
      folders.pop();
    }
    if (out.length >= 20_000) break;
  }
  return out;
}

function decode(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export async function importBookmarks(html: string): Promise<number> {
  const marks = parseBookmarksHtml(html);
  const existing = new Set((await db.items.filter((i) => !!i.url && !i.deletedAt).toArray()).map((i) => i.url));
  const now = Date.now();
  const items = marks
    .filter((m) => !existing.has(m.url) && (existing.add(m.url), true))
    .map((m, n) =>
      newItem({
        kind: 'link',
        title: m.title,
        url: m.url,
        // No automatic previews for a bulk import; they'd hit the rate limit. Refresh any item to fetch one.
        preview: null,
        tags: normalizeTags(['bookmarks', ...(m.folder && !/^(bookmarks bar|bookmarks toolbar|other bookmarks|favorites bar)$/i.test(m.folder) ? [m.folder] : [])]),
        createdAt: m.addedAt ?? now,
        updatedAt: now,
        order: now + n,
      }),
    );
  await db.items.bulkAdd(items);
  return items.length;
}
