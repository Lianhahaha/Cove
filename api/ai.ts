import {
  AI_LIMITS,
  AiOutputError,
  AiRequestError,
  buildMessages,
  originAllowed,
  parseOutput,
  parseRequest,
  pickModel,
} from './_lib/ai-guard';
import { clientIp, json, rateLimit } from './_lib/rate-limit';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const NO_STORE = { 'cache-control': 'no-store' };

const enabled = () => process.env.AI_ENABLED !== 'false' && !!process.env.GROQ_API_KEY;

/** Logs what happened without any of the user's content. */
function log(task: string, status: number, started: number) {
  console.info(JSON.stringify({ at: 'api/ai', task, status, ms: Date.now() - started }));
}

/** GET /api/ai: lets the app know whether AI is available on this deployment. */
export async function GET(): Promise<Response> {
  return json({ enabled: enabled() }, 200, NO_STORE);
}

/** POST /api/ai: { task, input } → validated JSON result. */
export async function POST(request: Request): Promise<Response> {
  const started = Date.now();
  if (!enabled()) return json({ error: 'AI isn’t set up on this server.' }, 503, NO_STORE);

  if (!originAllowed(request.headers.get('origin'), request.headers.get('host'), process.env.ALLOWED_ORIGINS)) {
    return json({ error: 'Requests must come from the Cove app.' }, 403, NO_STORE);
  }
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return json({ error: 'Send JSON.' }, 415, NO_STORE);
  }

  const perIp = rateLimit(`ai:${clientIp(request)}`, AI_LIMITS.perIpPer10Min, 10 * 60_000);
  if (!perIp.ok) return json({ error: 'You’ve used AI a lot just now. Try again in a few minutes.' }, 429, { ...NO_STORE, 'retry-after': String(perIp.retryAfter) });
  let task = 'unknown';
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > AI_LIMITS.bodyBytes) throw new AiRequestError('Request is too large', 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AiRequestError('Invalid JSON');
    }
    const parsed = parseRequest(body);
    task = parsed.task;
    // Only requests that will reach the model count toward the daily cap, so junk can't use it up.
    const global = rateLimit('ai:instance', AI_LIMITS.perInstancePerDay, 24 * 60 * 60_000);
    if (!global.ok) {
      log(task, 429, started);
      return json({ error: 'AI is busy today. Try again later.' }, 429, { ...NO_STORE, 'retry-after': String(global.retryAfter) });
    }
    const { messages, temperature, max_tokens } = buildMessages(parsed.task, parsed.input);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_LIMITS.timeoutMs);
    let upstream: Response;
    try {
      upstream = await fetch(GROQ_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: pickModel(process.env.AI_MODEL),
          messages,
          temperature,
          max_tokens,
          response_format: { type: 'json_object' },
        }),
      });
    } catch {
      const status = controller.signal.aborted ? 504 : 502;
      log(task, status, started);
      return json({ error: controller.signal.aborted ? 'The AI took too long. Try again.' : 'Couldn’t reach the AI service.' }, status, NO_STORE);
    } finally {
      clearTimeout(timer);
    }

    if (upstream.status === 429) {
      log(task, 429, started);
      return json({ error: 'The free AI quota is used up for now. Try again later.' }, 429, { ...NO_STORE, 'retry-after': upstream.headers.get('retry-after') ?? '60' });
    }
    if (!upstream.ok) {
      log(task, 502, started);
      return json({ error: 'The AI service had a problem. Try again.' }, 502, NO_STORE);
    }
    const data = (await upstream.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new AiOutputError('Empty reply');

    const result = parseOutput(parsed.task, content);
    log(task, 200, started);
    return json(result, 200, NO_STORE);
  } catch (e) {
    if (e instanceof AiRequestError) {
      log(task, e.status, started);
      return json({ error: e.message }, e.status, NO_STORE);
    }
    if (e instanceof AiOutputError) {
      log(task, 502, started);
      return json({ error: 'The AI gave an answer Cove couldn’t use. Try again.' }, 502, NO_STORE);
    }
    log(task, 500, started);
    return json({ error: 'Something went wrong.' }, 500, NO_STORE);
  }
}
