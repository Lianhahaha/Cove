import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import type { Readable } from 'node:stream';
import { assertFetchableUrl, BlockedUrlError, safeLookup } from './net-guard';

export const FETCH_LIMITS = {
  timeoutMs: 6000,
  maxBytes: 512 * 1024,
  maxRedirects: 3,
};

export interface FetchedPage {
  url: URL;
  contentType: string;
  /** Body text, present only for HTML and JSON responses. */
  html?: string;
}

export class FetchError extends Error {
  constructor(message: string, public status = 422) {
    super(message);
  }
}

function charsetOf(contentType: string, head: Buffer): string {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType)?.[1];
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head.toString('latin1'))?.[1];
  const label = (fromHeader || fromMeta || 'utf-8').toLowerCase();
  try {
    new TextDecoder(label);
    return label;
  } catch {
    return 'utf-8';
  }
}

function decompress(res: http.IncomingMessage): Readable {
  const enc = (res.headers['content-encoding'] || '').toString().toLowerCase();
  if (enc === 'gzip' || enc === 'x-gzip') return res.pipe(zlib.createGunzip());
  if (enc === 'deflate') return res.pipe(zlib.createInflate());
  if (enc === 'br') return res.pipe(zlib.createBrotliDecompress());
  return res;
}

/**
 * Reads a stream up to `max` bytes, then destroys it. The decompressor is
 * destroyed too, not just the socket: it may already hold a few KB of input
 * that would inflate to gigabytes (a compression bomb).
 */
export function readCapped(body: Readable, max: number, onCap: () => void = () => {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks, Math.min(size, max)));
    };
    body.on('data', (c: Buffer) => {
      if (done) return;
      const room = max - size;
      chunks.push(c.length > room ? c.subarray(0, room) : c);
      size += Math.min(c.length, room);
      if (size >= max) {
        finish();
        body.destroy();
        onCap();
      }
    });
    body.on('end', finish);
    body.on('error', (e) => {
      if (size > 0) finish();
      else if (!done) {
        done = true;
        reject(e);
      }
    });
  });
}

function requestOnce(url: URL, signal: AbortSignal): Promise<{ redirect?: URL; page?: FetchedPage }> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(
      url,
      {
        method: 'GET',
        lookup: safeLookup as never,
        signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; CoveLinkPreview/1.0; +https://github.com/Lianhahaha/Cove)',
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'en;q=0.9',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          try {
            resolve({ redirect: new URL(res.headers.location, url) });
          } catch {
            reject(new FetchError('Bad redirect'));
          }
          return;
        }
        if (status >= 400) {
          res.resume();
          reject(new FetchError(`The site answered ${status}`, status === 404 || status === 410 ? 404 : 422));
          return;
        }
        const contentType = (res.headers['content-type'] || '').toString();
        if (!/text\/html|application\/xhtml\+xml|application\/(?:json|json\+oembed)/i.test(contentType)) {
          // A PDF or image link: no HTML to read, but the final URL and type are still useful.
          res.destroy();
          resolve({ page: { url, contentType } });
          return;
        }
        readCapped(decompress(res), FETCH_LIMITS.maxBytes, () => res.destroy())
          .then((buf) => {
            const html = new TextDecoder(charsetOf(contentType, buf.subarray(0, 2048))).decode(buf);
            resolve({ page: { url, contentType, html } });
          })
          .catch(reject);
      },
    );
    req.on('error', (e) => reject(e));
    req.end();
  });
}

/** Fetches a public web page with redirects re-checked, a size cap and a deadline. */
export async function fetchPage(raw: string): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_LIMITS.timeoutMs);
  try {
    let url = assertFetchableUrl(raw);
    for (let hop = 0; hop <= FETCH_LIMITS.maxRedirects; hop++) {
      const { redirect, page } = await requestOnce(url, controller.signal);
      if (page) return page;
      url = assertFetchableUrl(redirect!);
    }
    throw new FetchError('Too many redirects');
  } catch (e) {
    if (e instanceof BlockedUrlError || (e as NodeJS.ErrnoException)?.code === 'EBLOCKED') throw new FetchError((e as Error).message, 400);
    if (e instanceof FetchError) throw e;
    if (controller.signal.aborted) throw new FetchError('The site took too long to answer', 504);
    throw new FetchError('Could not reach the site', 502);
  } finally {
    clearTimeout(timer);
  }
}
