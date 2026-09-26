import { useLocation } from 'preact-iso';

/** Items open in a panel over the current page, addressed by ?item=<id>. */
export function useItemNav() {
  const { path, query, route } = useLocation();
  return {
    openId: query.item ?? null,
    open: (id: string) => route(`${path}?item=${encodeURIComponent(id)}`),
    close: () => route(path, true),
  };
}

/** Navigates from code that lives outside components (toasts, notifications). */
export function navigate(url: string) {
  history.pushState(null, '', url);
  dispatchEvent(new PopStateEvent('popstate'));
}
