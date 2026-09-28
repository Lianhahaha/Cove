import { fetchPage, FetchError } from './_lib/fetch-page';
import { parseMeta, type PageMeta } from './_lib/meta';
import { oembedUrl, parseOEmbed } from './_lib/oembed';
import { clientIp, json, rateLimit } from './_lib/rate-limit';

/**
 * GET /api/preview?url=https://…
 * Returns title, description, image, site name and favicon for a public page.
 */
export async function GET(request: Request): Promise<Response> {
  const limit = rateLimit(`preview:${clientIp(request)}`, 60, 60_000);
  if (!limit.ok) return json({ error: 'Too many previews, try again shortly' }, 429, { 'retry-after': String(limit.retryAfter) });

  const target = new URL(request.url).searchParams.get('url');
  if (!target || target.length > 2048) return json({ error: 'Missing or overlong url' }, 400);
  // A malformed address is the link's fault, not the server's: a 5xx would have the app retry it forever.
  if (!URL.canParse(target)) return json({ error: 'Not a valid web address' }, 400);

  try {
    // Known video and music sites answer faster and better through oEmbed.
    const embed = oembedUrl(new URL(target));
    if (embed) {
      const fromEmbed = await fetchPage(embed)
        .then((p) => (p.html ? parseOEmbed(p.html) : null))
        .catch(() => null);
      if (fromEmbed) return ok(new URL(target), { ...fromEmbed, favicon: `${new URL(target).origin}/favicon.ico` });
    }

    const page = await fetchPage(target);
    const meta = page.html ? parseMeta(page.html, page.url) : {};
    const fileName = !page.html ? safeDecode(page.url.pathname.split('/').pop() || '').slice(0, 200) || undefined : undefined;
    return ok(page.url, { ...meta, title: meta.title ?? fileName });
  } catch (e) {
    const err = e instanceof FetchError ? e : new FetchError('Preview failed', 502);
    return json({ error: err.message }, err.status, { 'cache-control': 'public, s-maxage=600' });
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function ok(url: URL, meta: PageMeta): Response {
  return json(
    {
      url: url.href,
      title: meta.title,
      description: meta.description,
      image: meta.image,
      siteName: meta.siteName,
      favicon: meta.favicon ?? `${url.origin}/favicon.ico`,
    },
    200,
    // The same link looks the same to everyone, so let the CDN keep it for a day.
    { 'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
  );
}
