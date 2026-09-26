/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare global {
  // The build replaces self.__WB_MANIFEST with the list of files to precache.
  interface Window {
    __WB_MANIFEST: (string | { url: string; revision: string | null })[];
  }
}

const sw = self as unknown as ServiceWorkerGlobalScope;

// The app shell: HTML, JS, CSS and icons, versioned by the build.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Every page is the same single-page app, so serve index.html offline for any route.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// API calls must hit the network; the app keeps its own results in IndexedDB.
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());

// Link preview images and favicons from other sites, so cards still look right offline.
registerRoute(
  ({ request, url }) => request.destination === 'image' && url.origin !== sw.location.origin,
  new CacheFirst({
    cacheName: 'cove-preview-images',
    plugins: [
      // Cross-origin images come back opaque (status 0); they still display fine.
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true }),
    ],
  }),
);

sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void sw.skipWaiting();
});
