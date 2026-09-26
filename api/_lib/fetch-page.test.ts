import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import { readCapped } from './fetch-page';

describe('readCapped', () => {
  it('stops a compression bomb at the cap instead of inflating it all', async () => {
    // About 64 KB of gzip that inflates to 64 MB of zeros.
    const bomb = zlib.gzipSync(Buffer.alloc(64 * 1024 * 1024), { level: 1 });
    const inflater = Readable.from([bomb]).pipe(zlib.createGunzip());
    let seen = 0;
    inflater.on('data', (c: Buffer) => (seen += c.length));
    const buf = await readCapped(inflater, 512 * 1024);
    await new Promise((r) => setTimeout(r, 200));
    expect(buf.length).toBe(512 * 1024);
    // Allow a few chunks in flight, but nowhere near the full 64 MB.
    expect(seen).toBeLessThan(4 * 1024 * 1024);
  }, 20_000);

  it('returns short bodies whole', async () => {
    expect((await readCapped(Readable.from([Buffer.from('<title>x</title>')]), 1024)).toString()).toBe('<title>x</title>');
  });
});
