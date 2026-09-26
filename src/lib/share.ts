import { openCapture } from '../state';

/** Joins the title, text and url an app shared, without repeating the link. */
export function composeShared(title: string, text: string, url: string): string {
  const parts: string[] = [];
  for (const p of [title, text, url].map((s) => s.trim()).filter(Boolean)) {
    if (!parts.some((q) => q.includes(p))) parts.push(p);
  }
  return parts.join('\n');
}

/**
 * Picks up what the share sheet or a home-screen shortcut sent and opens the
 * capture dialog with it. Returns true when the URL had something to handle.
 */
export async function handleLaunchParams(): Promise<boolean> {
  const params = new URLSearchParams(location.search);
  const shareId = params.get('share');
  const clean = () => history.replaceState(null, '', location.pathname);

  if (params.get('capture') === '1') {
    clean();
    openCapture();
    return true;
  }
  if (!shareId || !/^[\w-]{1,64}$/.test(shareId) || !('caches' in window)) {
    if (shareId) clean();
    return false;
  }

  clean();
  const cache = await caches.open('cove-share');
  const prefix = `/__share/${shareId}/`;
  const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith(prefix));
  let text = '';
  const files: File[] = [];
  for (const req of keys) {
    const res = await cache.match(req);
    if (!res) continue;
    if (req.url.endsWith('/meta')) {
      const [title, body, url] = (await res.json()) as string[];
      text = composeShared(title ?? '', body ?? '', url ?? '');
    } else {
      const name = decodeURIComponent(res.headers.get('x-file-name') ?? 'shared-file');
      files.push(new File([await res.blob()], name, { type: res.headers.get('content-type') ?? '' }));
    }
    await cache.delete(req);
  }
  if (text || files.length) openCapture({ text, files });
  return true;
}
