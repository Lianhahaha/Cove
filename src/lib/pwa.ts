import { signal } from '@preact/signals';
import { registerSW } from 'virtual:pwa-register';
import { toast } from './toast';
import { navigate } from './nav';

/** Chrome/Edge/Android's deferred install prompt, if the app can be installed right now. */
export const installPrompt = signal<BeforeInstallPromptEvent | null>(null);
export const online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function promptInstall(): Promise<boolean> {
  const e = installPrompt.value;
  if (!e) return false;
  installPrompt.value = null;
  await e.prompt();
  return (await e.userChoice).outcome === 'accepted';
}

export function startPwa(): void {
  addEventListener('online', () => (online.value = true));
  addEventListener('offline', () => (online.value = false));
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt.value = e as BeforeInstallPromptEvent;
  });
  addEventListener('appinstalled', () => {
    installPrompt.value = null;
    toast('Cove is installed');
  });

  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  // The service worker asks the page to open a task when a reminder is clicked.
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type !== 'NAVIGATE' || typeof e.data.url !== 'string') return;
    // Only ever route within the app: resolve the URL and require the same origin ("//evil.example" resolves elsewhere).
    try {
      const target = new URL(e.data.url, location.origin);
      if (target.origin === location.origin) navigate(target.pathname + target.search);
    } catch {
      /* not a URL */
    }
  });
  const updateSW = registerSW({
    onNeedRefresh() {
      toast('A new version of Cove is ready', { action: { label: 'Reload', run: () => void updateSW(true) }, ms: 120_000 });
    },
    onOfflineReady() {
      toast('Cove is ready to work offline');
    },
    onRegisteredSW(_url, reg) {
      // Check for a new version every hour while the app stays open.
      if (reg) setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
}
