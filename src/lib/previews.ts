import { liveQuery } from 'dexie';
import { signal } from '@preact/signals';
import { db } from './db';
import { getSetting, updateItem } from './repo';
import type { LinkPreview } from './types';

/** Whether the app may send saved links to /api/preview. Mirrors the setting. */
export const previewsEnabled = signal(true);

const inFlight = new Set<string>();
let running = false;
/** Set when the endpoint isn't there (e.g. a static host), so we stop asking this session. */
let unavailable = false;
/** After a 429 the queue waits until this time before asking again. */
let pausedUntil = 0;

async function fetchPreview(url: string): Promise<{ ok: true; data: LinkPreview } | { ok: false; retry: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`/api/preview?url=${encodeURIComponent(url)}`, { signal: controller.signal });
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) {
      // The SPA fallback answered with HTML: there's no API on this host.
      unavailable = true;
      return { ok: false, retry: true };
    }
    const body = await res.json();
    if (res.ok) {
      return {
        ok: true,
        data: {
          status: 'ok',
          title: str(body.title, 300),
          description: str(body.description, 500),
          image: httpUrl(body.image),
          siteName: str(body.siteName, 100),
          favicon: httpUrl(body.favicon),
          fetchedAt: Date.now(),
        },
      };
    }
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after')) || 60;
      pausedUntil = Date.now() + Math.min(wait, 600) * 1000;
      setTimeout(() => void processPreviewQueue(), Math.min(wait, 600) * 1000 + 500);
      return { ok: false, retry: true };
    }
    // The server hiccuped: try again later. Anything else is the link's fault.
    const retry = res.status >= 500;
    return { ok: false, retry, error: str(body.error, 200) };
  } catch {
    return { ok: false, retry: true };
  } finally {
    clearTimeout(timer);
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined);
const httpUrl = (v: unknown) => (typeof v === 'string' && /^https?:\/\//i.test(v) && v.length <= 2048 ? v : undefined);

/** Fetches previews for every link still marked pending, two at a time. */
export async function processPreviewQueue(): Promise<void> {
  if (running || unavailable || !previewsEnabled.value || !navigator.onLine || Date.now() < pausedUntil) return;
  running = true;
  try {
    const pending = await db.items.filter((i) => !i.deletedAt && !!i.url && i.preview?.status === 'pending' && !inFlight.has(i.id)).toArray();
    const queue = [...pending];
    const worker = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        if (!navigator.onLine || unavailable || Date.now() < pausedUntil) return;
        inFlight.add(item.id);
        try {
          const result = await fetchPreview(item.url!);
          // The link may have been edited while the request was out.
          const current = await db.items.get(item.id);
          if (!current || current.url !== item.url) continue;
          if (result.ok) await updateItem(item.id, { preview: result.data });
          else if (!result.retry) await updateItem(item.id, { preview: { status: 'error', error: result.error, fetchedAt: Date.now() } });
        } finally {
          inFlight.delete(item.id);
        }
      }
    };
    await Promise.all([worker(), worker()]);
  } finally {
    running = false;
  }
}

/** Starts watching for links that need previews. Call once at startup. */
export function startPreviewQueue(): void {
  void getSetting('linkPreviews', true).then((v) => (previewsEnabled.value = v));
  addEventListener('online', () => void processPreviewQueue());
  liveQuery(() => db.items.filter((i) => i.preview?.status === 'pending' && !i.deletedAt).count()).subscribe({
    next: (n) => n > 0 && void processPreviewQueue(),
  });
}

export async function refreshPreview(id: string): Promise<void> {
  await updateItem(id, { preview: { status: 'pending' } });
  unavailable = false;
  await processPreviewQueue();
}
