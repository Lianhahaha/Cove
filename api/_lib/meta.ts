/** Pulls link-preview metadata out of an HTML document's head. */

export interface PageMeta {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (m, code: string) => {
    const lower = code.toLowerCase();
    if (lower in ENTITIES) return ENTITIES[lower];
    try {
      if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
      if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10));
    } catch {
      /* invalid code point: keep the original text */
    }
    return m;
  });
}

/**
 * Collapses whitespace, strips control characters and any tags, and clamps length.
 * Invisible zero-width and direction marks go too: they make titles look indented
 * and a right-to-left override can make a title read backwards.
 */
function clean(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const out = decodeEntities(s)
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return out || undefined;
}

/** Resolves a URL against the page and only keeps http(s) results. */
function absUrl(href: string | undefined, base: URL): string | undefined {
  if (!href) return undefined;
  try {
    const u = new URL(decodeEntities(href.trim()), base);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.href.length <= 2048 ? u.href : undefined;
  } catch {
    return undefined;
  }
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  }
  return out;
}

export function parseMeta(html: string, pageUrl: URL): PageMeta {
  // Only the head matters; cap the work on huge documents.
  const headEnd = html.search(/<\/head\s*>|<body[\s>]/i);
  const head = html.slice(0, headEnd === -1 ? 300_000 : headEnd);

  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content !== undefined && !(key in meta)) meta[key] = a.content;
  }

  let favicon: string | undefined;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = (a.rel || '').toLowerCase().split(/\s+/);
    if (rel.includes('icon') || rel.includes('apple-touch-icon')) {
      favicon ??= absUrl(a.href, pageUrl);
      if (rel.includes('icon') && a.href) {
        favicon = absUrl(a.href, pageUrl) ?? favicon;
        break;
      }
    }
  }

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];

  return {
    title: clean(meta['og:title'] || meta['twitter:title'] || titleTag, 300),
    description: clean(meta['og:description'] || meta['twitter:description'] || meta['description'], 500),
    image: absUrl(meta['og:image:secure_url'] || meta['og:image'] || meta['og:image:url'] || meta['twitter:image'] || meta['twitter:image:src'], pageUrl),
    siteName: clean(meta['og:site_name'] || meta['application-name'], 100),
    favicon: favicon ?? `${pageUrl.origin}/favicon.ico`,
  };
}
