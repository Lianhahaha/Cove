import { signal } from '@preact/signals';
import { liveQuery } from 'dexie';
import { db } from './db';
import { getSetting, setSetting } from './repo';
import { dueBucket, formatDue } from './dates';
import { displayTitle, isOpenTask } from './queries';
import { toast } from './toast';
import { navigate } from './nav';
import type { Item } from './types';

/** System notifications for reminders. Off until the user turns them on. */
export const remindersEnabled = signal(false);

const NOTIFIED_KEY = 'cove-notified';
/** Reminders missed by more than this (app closed all day) are skipped rather than fired late. */
const STALE_MS = 12 * 60 * 60 * 1000;

export const REMINDER_PRESETS: { label: string; minutesBefore: number }[] = [
  { label: 'At the due time', minutesBefore: 0 },
  { label: '10 minutes before', minutesBefore: 10 },
  { label: '1 hour before', minutesBefore: 60 },
  { label: '1 day before', minutesBefore: 24 * 60 },
];

function notified(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function markNotified(key: string) {
  const set = notified();
  set.add(key);
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set].slice(-500)));
  } catch {
    /* storage unavailable: worst case a reminder repeats */
  }
}

export async function enableReminders(on: boolean): Promise<boolean> {
  if (on && 'Notification' in window && Notification.permission !== 'granted') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') {
      toast('Notifications are blocked for this site. Reminders will show inside the app instead.');
      on = false;
    }
  }
  remindersEnabled.value = on;
  await setSetting('reminders', on);
  return on;
}

async function notify(item: Item) {
  const title = displayTitle(item);
  const body = item.due !== null ? `Due ${formatDue(item.due, item.dueHasTime)}` : 'Reminder';
  const url = `/tasks?item=${item.id}`;
  if (remindersEnabled.value && 'Notification' in window && Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag: item.id, data: { url }, icon: '/pwa-192x192.png', badge: '/pwa-64x64.png' });
      return;
    }
    new Notification(title, { body, tag: item.id, icon: '/pwa-192x192.png' });
    return;
  }
  toast(`⏰ ${title}. ${body}`, { action: { label: 'Open', run: () => navigate(url) }, ms: 15_000 });
}

export async function checkReminders(now = Date.now()) {
  const done = notified();
  const due = await db.items
    .filter((i) => i.remindAt !== null && i.remindAt <= now && i.remindAt > now - STALE_MS && isOpenTask(i) && !done.has(`${i.id}:${i.remindAt}`))
    .toArray();
  for (const item of due) {
    markNotified(`${item.id}:${item.remindAt}`);
    await notify(item);
  }
}

/** Starts the reminder loop and keeps the app icon badge in sync with what's due. */
export function startReminders() {
  void getSetting('reminders', false).then((v) => (remindersEnabled.value = v));
  setInterval(() => void checkReminders(), 30_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void checkReminders());
  setTimeout(() => void checkReminders(), 2000);

  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (!nav.setAppBadge) return;
  liveQuery(() => db.items.filter((i) => isOpenTask(i) && ['overdue', 'today'].includes(dueBucket(i.due, i.dueHasTime))).count()).subscribe({
    next: (n) => void (n ? nav.setAppBadge!(n) : nav.clearAppBadge?.())?.catch(() => {}),
  });
}
