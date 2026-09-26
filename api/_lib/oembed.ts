/**
 * oEmbed endpoints for sites whose pages are too heavy to read (YouTube puts
 * its title hundreds of KB into the page). Only these fixed hosts are used.
 */
const PROVIDERS: { hosts: RegExp; endpoint: string }[] = [
  { hosts: /(^|\.)youtube\.com$|^youtu\.be$/, endpoint: 'https://www.youtube.com/oembed' },
  { hosts: /(^|\.)vimeo\.com$/, endpoint: 'https://vimeo.com/api/oembed.json' },
  { hosts: /(^|\.)tiktok\.com$/, endpoint: 'https://www.tiktok.com/oembed' },
  { hosts: /^open\.spotify\.com$/, endpoint: 'https://open.spotify.com/oembed' },
];

export function oembedUrl(page: URL): string | null {
  const provider = PROVIDERS.find((p) => p.hosts.test(page.hostname.toLowerCase()));
  return provider ? `${provider.endpoint}?format=json&url=${encodeURIComponent(page.href)}` : null;
}

export interface OEmbedMeta {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, max) : undefined);
const link = (v: unknown) => (typeof v === 'string' && /^https?:\/\//i.test(v) && v.length <= 2048 ? v : undefined);

export function parseOEmbed(body: string): OEmbedMeta | null {
  try {
    const data = JSON.parse(body) as Record<string, unknown>;
    const title = text(data.title, 300);
    if (!title) return null;
    const author = text(data.author_name, 100);
    return {
      title,
      description: author ? `by ${author}` : undefined,
      image: link(data.thumbnail_url),
      siteName: text(data.provider_name, 100),
    };
  } catch {
    return null;
  }
}
