/** The last few searches, kept on this device so a phone doesn't retype them. */
const KEY = 'cove-recent-searches';
export const RECENT_LIMIT = 6;

export function loadRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string' && s.length <= 200).slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function save(list: string[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: recent searches last for this session only */
  }
}

/** Records a finished search, newest first and without duplicates. */
export function addRecent(query: string): string[] {
  const q = query.trim();
  if (!q) return loadRecent();
  const next = [q, ...loadRecent().filter((s) => s !== q)].slice(0, RECENT_LIMIT);
  save(next);
  return next;
}

export function forgetRecent(query: string): string[] {
  const next = loadRecent().filter((s) => s !== query);
  save(next);
  return next;
}

export function clearRecent(): void {
  save([]);
}
