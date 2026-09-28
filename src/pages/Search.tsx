import { useEffect, useMemo, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Search as SearchIcon, X } from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { search, searchIndex, startSearchIndex } from '../lib/search';
import { FILTER_EXAMPLES, hasFilters, matchesFilters, parseSearchQuery } from '../lib/filters';
import { sortItems } from '../lib/queries';
import { useCardContext } from '../lib/useCardContext';
import type { Item } from '../lib/types';
import { ItemRow } from '../components/ItemCard';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

type Scope = 'active' | 'all';

export function Search() {
  const { query, route } = useLocation();
  const q = query.q ?? '';
  const scope: Scope = query.in === 'all' ? 'all' : 'active';
  const spaceId = query.space ?? '';
  const input = useRef<HTMLInputElement>(null);
  const spaces = useLive(() => db.spaces.orderBy('order').filter((s) => !s.deletedAt).toArray(), []) ?? [];
  const ctx = useCardContext(true);

  useEffect(() => {
    startSearchIndex();
    input.current?.focus();
  }, []);

  // Keep the query in the URL so back/forward and reloads keep the search.
  const setParams = (next: Record<string, string>) => {
    const params = new URLSearchParams({ q, ...(scope === 'all' ? { in: 'all' } : {}), ...(spaceId ? { space: spaceId } : {}), ...next });
    for (const [k, v] of [...params]) if (!v) params.delete(k);
    route(`/search${params.size ? '?' + params : ''}`, true);
  };

  const parsed = useMemo(() => parseSearchQuery(q), [q]);
  const ids = useMemo(() => search(parsed.text), [parsed.text, searchIndex.value]);
  const results = useLive(async () => {
    const now = new Date();
    const pass = (i: Item | undefined): i is Item => !!i && matchesFilters(i, parsed, now);
    // Filters with no words list everything that matches, newest first.
    const items = parsed.text ? (await db.items.bulkGet(ids)).filter(pass) : hasFilters(parsed) ? sortItems(await db.items.filter(pass).toArray(), 'recent').slice(0, 200) : [];
    const withArchived = scope === 'all' || parsed.is.includes('archived');
    return items.filter((i) => (withArchived || !i.archived) && (!spaceId || (spaceId === 'inbox' ? i.spaceId === null : i.spaceId === spaceId)));
  }, [ids.join(','), q, scope, spaceId]);

  /** Adds an example filter to the query, or starts one for the user to finish. */
  const addFilter = (f: string) => {
    setParams({ q: `${q.trim()} ${f}`.trimStart() + (f.endsWith(':') ? '' : ' ') });
    input.current?.focus();
  };

  return (
    <>
      <PageHeader title="Search" />
      <div class="px-3 md:px-6 py-3 md:py-4 max-w-3xl mx-auto w-full space-y-4">
        <div class="relative">
          <SearchIcon size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
          <input
            ref={input}
            type="search"
            class="input pl-10 pr-10 h-12 text-base"
            placeholder="Search titles, notes, links, tags and file names"
            value={q}
            onInput={(e) => setParams({ q: e.currentTarget.value })}
            aria-label="Search"
            enterKeyHint="search"
          />
          {q && (
            <button class="icon-btn absolute right-1.5 top-1/2 -translate-y-1/2" aria-label="Clear search" onClick={() => setParams({ q: '' })}>
              <X size={16} />
            </button>
          )}
        </div>
        <div class="flex flex-wrap gap-2 text-sm">
          <select class="input w-auto min-h-8 h-8 py-0" value={spaceId} onChange={(e) => setParams({ space: e.currentTarget.value })} aria-label="Space">
            <option value="">All spaces</option>
            <option value="inbox">Unsorted</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
            ))}
          </select>
          <label class="flex items-center gap-2 text-muted cursor-pointer">
            <input type="checkbox" class="w-4 h-4 accent-[var(--c-accent)]" checked={scope === 'all'} onChange={(e) => setParams({ in: e.currentTarget.checked ? 'all' : '' })} />
            Include archived
          </label>
        </div>

        {!q.trim() ? (
          <EmptyState icon={<SearchIcon size={22} />} title="Find anything">
            <p>Search works offline. Try a word from a note, a site name, or a tag.</p>
            <p class="mt-3">Narrow it down with filters:</p>
            <div class="mt-2 flex flex-wrap justify-center gap-1.5">
              {FILTER_EXAMPLES.map((f) => (
                <button key={f} type="button" class="kbd hover:bg-surface3" onClick={() => addFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
          </EmptyState>
        ) : results && results.length === 0 ? (
          <p class="text-sm text-subtle py-6 text-center">No matches for “{q}”.</p>
        ) : (
          <>
            {results && <p class="text-xs text-subtle">{results.length} result{results.length === 1 ? '' : 's'}</p>}
            <div class="-mx-3 space-y-0.5">
              {results?.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} />)}
            </div>
          </>
        )}
      </div>
    </>
  );
}
