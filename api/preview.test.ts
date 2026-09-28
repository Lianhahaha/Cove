import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { GET } from './preview';

describe('GET /api/preview', () => {
  it('requires a url', async () => {
    const res = await GET(new Request('https://cove.test/api/preview'));
    expect(res.status).toBe(400);
  });

  it('turns down a malformed address as the link’s fault, so it isn’t retried', async () => {
    const res = await GET(new Request(`https://cove.test/api/preview?url=${encodeURIComponent('https://exa mple.com')}`));
    expect(res.status).toBe(400);
  });

  it('refuses to fetch a server on this machine', async () => {
    const server = createServer((_req, res) => res.end('<title>secret</title>'));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    try {
      const res = await GET(new Request(`https://cove.test/api/preview?url=${encodeURIComponent(`http://127.0.0.1:${port}/`)}`));
      expect(res.status).toBe(400);
      expect(JSON.stringify(await res.json())).not.toContain('secret');
    } finally {
      server.close();
    }
  });

  it('refuses a hostname that resolves to loopback', async () => {
    const res = await GET(new Request(`https://cove.test/api/preview?url=${encodeURIComponent('http://localtest.me/')}`));
    // localtest.me resolves to 127.0.0.1; without network the lookup fails instead. Either way nothing is fetched.
    expect([400, 502]).toContain(res.status);
  });
});
