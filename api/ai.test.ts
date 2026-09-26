import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './ai';

let ip = 0;
const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://cove.app/api/ai', {
    method: 'POST',
    headers: {
      origin: 'https://cove.app',
      host: 'cove.app',
      'content-type': 'application/json',
      // A fresh IP per request keeps the per-IP limit out of the way.
      'x-forwarded-for': `10.0.${Math.floor(ip / 250)}.${ip++ % 250}`,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

function groqReplies(content: string, status = 200) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.GROQ_API_KEY = 'test-key';
  process.env.AI_ENABLED = 'true';
  delete process.env.ALLOWED_ORIGINS;
  delete process.env.AI_MODEL;
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('/api/ai', () => {
  it('reports availability', async () => {
    expect(await (await GET()).json()).toEqual({ enabled: true });
    process.env.AI_ENABLED = 'false';
    expect(await (await GET()).json()).toEqual({ enabled: false });
  });

  it('is off without a key', async () => {
    delete process.env.GROQ_API_KEY;
    expect((await POST(req({ task: 'tags', input: { text: 'x' } }))).status).toBe(503);
  });

  it('rejects other origins and non-JSON bodies', async () => {
    expect((await POST(req({ task: 'tags', input: { text: 'x' } }, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await POST(req('task=tags', { 'content-type': 'text/plain' }))).status).toBe(415);
    expect((await POST(req('{not json'))).status).toBe(400);
  });

  it('rejects oversized requests before calling the model', async () => {
    const fetchMock = groqReplies('{}');
    const res = await POST(req({ task: 'summarize', input: { text: 'x'.repeat(40_000) } }));
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the fixed prompt and model, ignoring client overrides', async () => {
    const fetchMock = groqReplies(JSON.stringify({ tags: ['Circuits', 'lab'] }));
    const res = await POST(req({ task: 'tags', input: { text: 'Kirchhoff lab', existingTags: ['lab'] }, model: 'expensive', temperature: 2 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ task: 'tags', tags: ['circuits', 'lab'] });
    const sent = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(sent.model).toBe('llama-3.1-8b-instant');
    expect(sent.temperature).toBe(0.2);
    expect(sent.response_format).toEqual({ type: 'json_object' });
  });

  it('turns an unusable model reply into a 502', async () => {
    groqReplies('I cannot do that');
    expect((await POST(req({ task: 'tags', input: { text: 'x' } }))).status).toBe(502);
  });

  it('passes on the upstream rate limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } })));
    const res = await POST(req({ task: 'tags', input: { text: 'x' } }));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
  });

  it('limits requests per IP', async () => {
    groqReplies(JSON.stringify({ tags: ['a'] }));
    const statuses: number[] = [];
    for (let n = 0; n < 22; n++) statuses.push((await POST(req({ task: 'tags', input: { text: 'x' } }, { 'x-forwarded-for': '203.0.113.9' }))).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(20)).toEqual([429, 429]);
  });

  it('never logs the user content', async () => {
    groqReplies(JSON.stringify({ tags: ['a'] }));
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await POST(req({ task: 'tags', input: { text: 'my secret diary entry' } }));
    expect(info).toHaveBeenCalled();
    expect(JSON.stringify(info.mock.calls)).not.toContain('secret');
  });
});
