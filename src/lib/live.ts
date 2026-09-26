import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

/**
 * Runs a Dexie query and re-runs it whenever the tables it read change.
 * Returns undefined until the first result arrives.
 */
export function useLive<T>(query: () => Promise<T> | T, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (v) => setValue(() => v),
      error: (e) => console.error('Live query failed', e),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
