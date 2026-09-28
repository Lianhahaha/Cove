import { signal } from '@preact/signals';
import { db } from './db';
import { getSetting, setSetting, updateItem } from './repo';
import { displayTitle } from './queries';
import { toast } from './toast';

export interface FocusState {
  itemId: string | null;
  title: string;
  mode: 'focus' | 'break';
  minutes: number;
  /** When the current run ends; null while paused. */
  endsAt: number | null;
  /** Milliseconds left, kept while paused. */
  remaining: number;
}

export interface FocusSession {
  itemId: string | null;
  minutes: number;
  at: number;
}

const KEY = 'cove-focus';
export const FOCUS_PRESETS = [15, 25, 50];
export const BREAK_MINUTES = 5;
const LOG_LIMIT = 2000;

function load(): FocusState | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as FocusState | null;
    return s && typeof s.remaining === 'number' ? s : null;
  } catch {
    return null;
  }
}

export const focus = signal<FocusState | null>(typeof localStorage === 'undefined' ? null : load());
/** Ticks once a second while a timer runs, so the display updates. */
export const now = signal(Date.now());

function save(s: FocusState | null) {
  focus.value = s;
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the timer lasts for this session */
  }
}

export const remainingMs = (s: FocusState, at = now.value) => (s.endsAt === null ? s.remaining : Math.max(0, s.endsAt - at));

export async function startFocus(itemId: string | null, minutes: number) {
  const item = itemId ? await db.items.get(itemId) : null;
  const ms = minutes * 60_000;
  save({ itemId, title: item ? displayTitle(item) : 'Focus', mode: 'focus', minutes, endsAt: Date.now() + ms, remaining: ms });
}

export function pauseFocus() {
  const s = focus.value;
  if (!s || s.endsAt === null) return;
  save({ ...s, remaining: remainingMs(s, Date.now()), endsAt: null });
}

export function resumeFocus() {
  const s = focus.value;
  if (!s || s.endsAt !== null) return;
  save({ ...s, endsAt: Date.now() + s.remaining });
}

export function stopFocus() {
  save(null);
}

export async function focusLog(): Promise<FocusSession[]> {
  return getSetting<FocusSession[]>('focusLog', []);
}

/** Adds sessions from a backup to the log, skipping any it already has. */
export async function mergeFocusLog(incoming: unknown): Promise<void> {
  if (!Array.isArray(incoming)) return;
  const log = await focusLog();
  const key = (s: FocusSession) => `${s.at}:${s.itemId}:${s.minutes}`;
  const seen = new Set(log.map(key));
  const latest = Date.now() + 86_400_000;
  const added = incoming
    .filter((s): s is FocusSession => {
      if (!s || typeof s !== 'object') return false;
      const { itemId, minutes, at } = s as Record<string, unknown>;
      return (
        (itemId === null || (typeof itemId === 'string' && itemId.length <= 64)) &&
        typeof minutes === 'number' && minutes > 0 && minutes <= 600 &&
        typeof at === 'number' && at > 0 && at <= latest
      );
    })
    .map((s) => ({ itemId: s.itemId, minutes: Math.round(s.minutes), at: s.at }))
    .filter((s) => !seen.has(key(s)) && (seen.add(key(s)), true));
  if (added.length) await setSetting('focusLog', [...log, ...added].sort((a, b) => a.at - b.at).slice(-LOG_LIMIT));
}

async function logSession(itemId: string | null, minutes: number) {
  const log = await focusLog();
  await setSetting('focusLog', [...log, { itemId, minutes, at: Date.now() }].slice(-LOG_LIMIT));
  if (itemId) {
    const item = await db.items.get(itemId);
    if (item) await updateItem(itemId, { focusMins: (item.focusMins ?? 0) + minutes });
  }
}

/** Two short tones, generated so no audio file is needed. */
function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.22);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    /* audio blocked until the page has had a user gesture */
  }
}

async function notify(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return reg.showNotification(title, { body, tag: 'cove-focus', icon: '/pwa-192x192.png' });
  }
}

let finishing = false;

/**
 * Runs `fn` once per finished session across all open tabs: a Web Lock makes
 * tabs take turns, and a marker in localStorage tells later tabs it's done.
 */
async function once(key: string, fn: () => Promise<void>) {
  const run = async () => {
    try {
      if (localStorage.getItem('cove-focus-finished') === key) return;
      localStorage.setItem('cove-focus-finished', key);
    } catch {
      /* no storage: fall through and run in this tab */
    }
    await fn();
  };
  if (navigator.locks) await navigator.locks.request('cove-focus-finish', run);
  else await run();
}

async function finish(s: FocusState) {
  if (finishing) return;
  finishing = true;
  try {
    await once(`${s.mode}:${s.endsAt}`, () => finishOnce(s));
  } finally {
    finishing = false;
  }
}

async function finishOnce(s: FocusState) {
  chime();
  if (s.mode === 'focus') {
    await logSession(s.itemId, s.minutes);
    const ms = BREAK_MINUTES * 60_000;
    save({ ...s, mode: 'break', minutes: BREAK_MINUTES, endsAt: Date.now() + ms, remaining: ms });
    toast(`Nice. ${s.minutes} minutes of focus logged. Take a ${BREAK_MINUTES}-minute break.`, { ms: 10_000 });
    void notify('Focus done', `${s.minutes} minutes on ${s.title}. Break time.`);
  } else {
    save(null);
    toast('Break’s over', {
      action: { label: 'Focus again', run: () => void startFocus(s.itemId, 25) },
      ms: 15_000,
    });
    void notify('Break’s over', 'Ready for another round?');
  }
}

/** Keeps time from the end timestamp, so sleeping tabs and reloads stay accurate. */
export function startFocusClock() {
  const tick = () => {
    now.value = Date.now();
    const s = focus.value;
    if (s && s.endsAt !== null && s.endsAt <= now.value) void finish(s);
  };
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', tick);
  // Starting, pausing or stopping in one tab updates the others.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) focus.value = load();
  });
  tick();
}

export const formatClock = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
