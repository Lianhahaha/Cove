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
