import { signal } from '@preact/signals';
import { getSetting, setSetting } from './repo';
import type { Item, Space } from './types';

export type AiTask = 'summarize' | 'tags' | 'extract_tasks' | 'quiz';

export type AiResult =
  | { task: 'summarize'; summary: string; keyPoints: string[] }
  | { task: 'tags'; tags: string[] }
  | { task: 'extract_tasks'; tasks: { title: string; due: string | null; time: string | null }[] }
  | { task: 'quiz'; questions: { question: string; choices: string[]; answer: number; explanation: string }[] };

export const AI_TASK_LABELS: Record<AiTask, string> = {
  summarize: 'Summarize',
  tags: 'Suggest tags',
  extract_tasks: 'Find tasks and deadlines',
  quiz: 'Make a practice quiz',
};

/** Same cap as the server, so the review step shows exactly what's sent. */
export const AI_INPUT_CHARS = 8000;
export const AI_DAILY_LIMIT = 40;

/** Off until the user turns it on and accepts the notice. */
export const aiEnabled = signal(false);
/** Show the exact text before each request. On by default. */
export const aiReview = signal(true);
/** Whether this deployment has AI configured; null until checked. */
export const aiAvailable = signal<boolean | null>(null);

export async function loadAiSettings() {
  aiEnabled.value = await getSetting('ai', false);
  aiReview.value = await getSetting('aiReview', true);
}

export async function setAiEnabled(on: boolean) {
  aiEnabled.value = on;
  await setSetting('ai', on);
}

export async function setAiReview(on: boolean) {
  aiReview.value = on;
  await setSetting('aiReview', on);
}

export async function checkAiAvailable(): Promise<boolean> {
  if (aiAvailable.value !== null) return aiAvailable.value;
  try {
    const res = await fetch('/api/ai');
    const ok = res.ok && (res.headers.get('content-type') ?? '').includes('json') && (await res.json()).enabled === true;
    aiAvailable.value = ok;
  } catch {
    // Offline: don't remember the answer, ask again next time.
    return false;
  }
  return aiAvailable.value;
}

// ─── Redaction ─────────────────────────────────────────────────────────

const RULES: [RegExp, string][] = [
  // Credentials written as "password: x", "pin = 1234" and similar.
  [/\b(password|passwd|pwd|passcode|pin|otp|secret|api[_ -]?key|token)(\s*(?:is|:|=)\s*)\S+/gi, '$1$2[hidden]'],
  // Well-known key and token formats.
  [/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|gsk_[A-Za-z0-9]{20,})\b/g, '[secret]'],
  // JSON Web Tokens.
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[secret]'],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]'],
  // Philippine mobile numbers, then other international numbers.
  [/(?:\+?63|\b0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, '[phone]'],
  [/\+\d{1,3}[\s-]?\(?\d{1,4}\)?(?:[\s-]?\d{2,4}){2,4}\b/g, '[phone]'],
  // Card-like digit runs.
  [/\b(?:\d[ -]?){13,19}\b/g, '[number]'],
  // Long random-looking strings that mix letters and digits.
  [/\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g, '[secret]'],
];

/** Hides personal details and secrets before any text leaves the device. */
export function redact(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const [re, replacement] of RULES) {
    out = out.replace(re, (...args) => {
      count++;
      return replacement.replace('$1', args[1] ?? '').replace('$2', args[2] ?? '');
    });
  }
  return { text: out, count };
}

// ─── Eligibility and quota ─────────────────────────────────────────────

/** Why this item can't be sent to AI, or null if it can. */
export function aiBlockedReason(item: Item, space: Space | null | undefined): string | null {
  if (item.private) return 'This item is private, so it’s never sent to AI.';
  if (space?.aiExcluded) return `${space.name} is set to stay away from AI.`;
  return null;
}

const USAGE_KEY = 'cove-ai-usage';
const today = () => new Date().toISOString().slice(0, 10);

export function usedToday(): number {
  try {
    const u = JSON.parse(localStorage.getItem(USAGE_KEY) ?? '{}') as { date?: string; count?: number };
    return u.date === today() ? (u.count ?? 0) : 0;
  } catch {
    return 0;
  }
}

function countUse() {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today(), count: usedToday() + 1 }));
  } catch {
    /* storage unavailable */
  }
}

export interface AiPayload {
  title: string;
  text: string;
  existingTags?: string[];
}

/** The exact payload that would be sent: redacted and trimmed to the server's limit. */
export function preparePayload(p: AiPayload) {
  const title = redact(p.title.slice(0, 300));
  const body = redact(p.text);
  const truncated = body.text.length > AI_INPUT_CHARS;
  const d = new Date();
  const localToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    input: { title: title.text, text: body.text.slice(0, AI_INPUT_CHARS), existingTags: (p.existingTags ?? []).slice(0, 50), today: localToday },
    redactions: title.count + body.count,
    truncated,
  };
}

export class AiError extends Error {}

export async function runAi(task: AiTask, input: ReturnType<typeof preparePayload>['input']): Promise<AiResult> {
  if (!aiEnabled.value) throw new AiError('AI is turned off. Turn it on in Settings.');
  if (!navigator.onLine) throw new AiError('You’re offline. AI needs a connection.');
  if (usedToday() >= AI_DAILY_LIMIT) throw new AiError(`You’ve reached today’s limit of ${AI_DAILY_LIMIT} AI requests on this device.`);
  if (!(await checkAiAvailable())) throw new AiError('AI isn’t set up on this server.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task, input }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new AiError(typeof body.error === 'string' ? body.error : 'The AI request failed.');
    countUse();
    if (body.task !== task) throw new AiError('The AI answered a different question. Try again.');
    return body as AiResult;
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(controller.signal.aborted ? 'The AI took too long. Try again.' : 'Couldn’t reach the AI. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
}
