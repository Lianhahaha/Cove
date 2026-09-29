import { useLocation } from 'preact-iso';

// ─── In-app history ──────────────────────────────────────────────────────
// Installed on a computer or an iPhone, Cove has no browser Back button, so it
// draws its own. Each history entry records how many Cove pages sit behind it,
// which lets Back step within the app and never out of it.

const INDEX = 'coveIndex';

const indexOf = (state: unknown): number => {
  const v = state && typeof state === 'object' ? (state as Record<string, unknown>)[INDEX] : undefined;
  return typeof v === 'number' ? v : 0;
};

const withIndex = (state: unknown, index: number) => ({ ...(state && typeof state === 'object' ? state : {}), [INDEX]: index });

/** Numbers every history entry. Runs once, before the router makes its first entry. */
export function trackHistory() {
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  history.pushState = (state, unused, url) => push(withIndex(state, indexOf(history.state) + 1), unused, url);
  history.replaceState = (state, unused, url) => replace(withIndex(state, indexOf(history.state)), unused, url);
}

/** True when the previous history entry is a Cove page. */
export const canGoBack = () => indexOf(history.state) > 0;

/**
 * The page's URL with an item's panel open, or closed when `id` is null. The
 * page's own query stays, so a search behind the panel keeps its results.
 */
export function itemUrl(path: string, query: Record<string, string>, id: string | null): string {
  const params = new URLSearchParams(Object.entries(query).filter(([k]) => k !== 'item'));
  if (id) params.set('item', id);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Items open in a panel over the current page, addressed by ?item=<id>. */
export function useItemNav() {
  const { path, query, route } = useLocation();
  return {
    openId: query.item ?? null,
    open: (id: string) => route(itemUrl(path, query, id)),
    // Stepping back drops the panel's history entry, so Back afterwards leaves the page
    // instead of reopening the item. A panel opened from a shared link just closes.
    close: () => (canGoBack() ? history.back() : route(itemUrl(path, query, null), true)),
  };
}

/** The Back button: the previous Cove page, or Home when there isn't one. */
export function useBack() {
  const { route } = useLocation();
  return () => (canGoBack() ? history.back() : route('/', true));
}

/** Navigates from code that lives outside components (toasts, notifications). */
export function navigate(url: string) {
  history.pushState(null, '', url);
  dispatchEvent(new PopStateEvent('popstate'));
}
