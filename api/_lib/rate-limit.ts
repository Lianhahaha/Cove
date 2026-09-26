/**
 * Best-effort fixed-window rate limit kept in memory. Serverless instances
 * don't share memory, so this slows abuse per instance rather than enforcing
 * an exact global quota.
 */
const windows = new Map<string, { start: number; count: number; windowMs: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  // Drop expired entries now and then so the map can't grow without bound. Each entry
  // expires on its own window, so a short per-IP window can't wipe a daily counter.
  if (windows.size > 5000) {
    for (const [k, w] of windows) if (now - w.start > w.windowMs) windows.delete(k);
  }
  const w = windows.get(key);
  if (!w || now - w.start > windowMs) {
    windows.set(key, { start: now, count: 1, windowMs });
    return { ok: true, retryAfter: 0 };
  }
  w.count++;
  return w.count > limit ? { ok: false, retryAfter: Math.ceil((w.start + windowMs - now) / 1000) } : { ok: true, retryAfter: 0 };
}

/** The client IP as seen by Vercel's proxy. */
export function clientIp(request: Request): string {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', ...headers },
  });
}
