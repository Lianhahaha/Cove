import { useMemo } from 'preact/hooks';
import { db } from './db';
import { useLive } from './live';
import { useItemNav } from './nav';
import type { CardContext } from '../components/ItemCard';
import type { Space } from './types';

/** Shared lookups every item list needs: spaces by id and file counts per item. */
export function useCardContext(showSpace: boolean): CardContext {
  const { open } = useItemNav();
  const spaces = useLive(() => db.spaces.toArray(), []);
  // Only the itemId index is read, so no file blobs are loaded.
  const fileKeys = useLive(() => db.files.orderBy('itemId').keys(), []);
  return useMemo(() => {
    const spaceMap = new Map<string, Space>((spaces ?? []).map((s) => [s.id, s]));
    const fileCounts = new Map<string, number>();
    for (const k of (fileKeys ?? []) as string[]) fileCounts.set(k, (fileCounts.get(k) ?? 0) + 1);
    return { spaces: spaceMap, fileCounts, showSpace, onOpen: open };
  }, [spaces, fileKeys, showSpace, open]);
}
