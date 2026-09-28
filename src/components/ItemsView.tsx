import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { Archive, CheckCheck, Folder, Hash, LayoutGrid, List, SquareMousePointer, Trash, X } from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { usePref } from '../lib/prefs';
import { SORT_LABELS, sortItems, type SortMode } from '../lib/queries';
import { useCardContext } from '../lib/useCardContext';
import { archiveWithUndo, setDone, trashWithUndo } from '../lib/actions';
import { normalizeTag, TRASH_DAYS, updateItem } from '../lib/repo';
import { toast } from '../lib/toast';
import { confirmAction } from '../lib/confirm';
import type { Item } from '../lib/types';
import { ItemRow, ItemTile } from './ItemCard';
import { PageHeader } from './PageHeader';
import { QuickAdd } from './QuickAdd';

type KindFilter = 'all' | 'link' | 'note' | 'file' | 'task';
const KIND_LABELS: Record<KindFilter, string> = { all: 'All', link: 'Links', note: 'Notes', file: 'Files', task: 'Tasks' };

interface Props {
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  /** Stable key for this view's saved layout and sort. */
  prefKey: string;
  filter: (item: Item) => boolean;
  /** Re-run the query when these change (for example the route's space id). */
  deps?: unknown[];
  defaultSpaceId?: string | null;
  showSpace?: boolean;
  showQuickAdd?: boolean;
  empty: ComponentChildren;
  headerActions?: ComponentChildren;
  /** Extra content under the header, like a space's description. */
  intro?: ComponentChildren;
  defaultLayout?: 'list' | 'grid';
}

export function ItemsView({ title, subtitle, prefKey, filter, deps = [], defaultSpaceId = null, showSpace = true, showQuickAdd = true, empty, headerActions, intro, defaultLayout = 'list' }: Props) {
  const [layout, setLayout] = usePref<'list' | 'grid'>(`${prefKey}:layout`, defaultLayout);
  const [sort, setSort] = usePref<SortMode>(`${prefKey}:sort`, 'recent');
  const [picked, setKind] = useState<KindFilter>('all');
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const items = useLive(() => db.items.filter(filter).toArray(), [prefKey, ...deps]);
  const base = useCardContext(showSpace);

  const kindsPresent = useMemo(() => {
    const s = new Set<KindFilter>(['all']);
    for (const i of items ?? []) {
      s.add(i.kind);
      if (i.status !== 'none') s.add('task');
      if (base.fileCounts.has(i.id)) s.add('file');
    }
    return (Object.keys(KIND_LABELS) as KindFilter[]).filter((k) => s.has(k));
  }, [items, base.fileCounts]);
  // The tabs hide when there's little to pick from, so a type that's gone (or hidden) falls back to All.
  const kind = kindsPresent.length > 2 && kindsPresent.includes(picked) ? picked : 'all';

  const visible = useMemo(() => {
    // "Files" also covers notes and links that have attachments.
    const hasFiles = (i: Item) => i.kind === 'file' || base.fileCounts.has(i.id);
    const list = (items ?? []).filter((i) =>
      kind === 'all' ? true : kind === 'task' ? i.status !== 'none' : kind === 'file' ? hasFiles(i) : i.kind === kind,
    );
    return sortItems(list, sort);
  }, [items, kind, sort, base.fileCounts]);

  const ctx = useMemo(
    () => ({
      ...base,
      selected: selected ?? undefined,
      onToggleSelect: (id: string) => {
        const next = new Set(selected ?? []);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelected(next);
      },
    }),
    [base, selected],
  );

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {headerActions}
            <button
              class={`icon-btn ${selected ? 'text-accent bg-accent-fill' : ''}`}
              title="Select"
              aria-label="Select items"
              aria-pressed={!!selected}
              onClick={() => setSelected(selected ? null : new Set())}
            >
              <SquareMousePointer size={18} />
            </button>
            <button
              class="icon-btn"
              title={layout === 'list' ? 'Grid view' : 'List view'}
              aria-label={layout === 'list' ? 'Switch to grid view' : 'Switch to list view'}
              onClick={() => setLayout(layout === 'list' ? 'grid' : 'list')}
            >
              {layout === 'list' ? <LayoutGrid size={18} /> : <List size={18} />}
            </button>
          </>
        }
      />

      <div class="px-3 md:px-6 py-3 md:py-4 max-w-5xl mx-auto w-full space-y-4">
        {intro}
        {showQuickAdd && <QuickAdd defaultSpaceId={defaultSpaceId} />}

        {(items?.length ?? 0) > 0 && (
          <div class="flex items-center gap-2 flex-wrap">
            {/* Only worth showing when there's more than one type to pick from. */}
            {kindsPresent.length > 2 && (
            <div class="flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter by type">
              {kindsPresent.map((k) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={kind === k}
                  class={`px-2.5 h-7 rounded-full text-[0.8125rem] whitespace-nowrap ${kind === k ? 'bg-accent-fill text-accent font-medium' : 'text-muted hover:bg-surface3'}`}
                  onClick={() => setKind(k)}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
            )}
            <div class="flex-1" />
            <label class="flex items-center gap-1.5 text-sm text-subtle">
              <span class="sr-only sm:not-sr-only">Sort</span>
              <select
                class="bg-transparent text-text text-sm rounded-md px-1 py-1 hover:bg-surface3"
                value={sort}
                onChange={(e) => setSort(e.currentTarget.value as SortMode)}
              >
                {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                  <option key={m} value={m}>{SORT_LABELS[m]}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {items === undefined ? null : visible.length === 0 ? (
          items.length === 0 ? empty : <p class="text-sm text-subtle px-3 py-6">Nothing of this type here.</p>
        ) : layout === 'list' ? (
          <div class="-mx-3 space-y-0.5">
            {visible.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} />)}
          </div>
        ) : (
          // Columns instead of a grid, so each card keeps its own height, like a pinboard.
          <div class="columns-2 lg:columns-3 gap-2 md:gap-3 [&>*]:mb-2 md:[&>*]:mb-3 [&>*]:break-inside-avoid">
            {visible.map((i) => <ItemTile key={i.id} item={i} ctx={ctx} />)}
          </div>
        )}
      </div>

      {/* Only what's on screen: items hidden by the type filter, or gone since, stay out of bulk actions. */}
      {selected && <BulkBar items={visible.filter((i) => selected.has(i.id))} all={visible} onDone={() => setSelected(null)} onSelectAll={() => setSelected(new Set(visible.map((i) => i.id)))} />}
    </>
  );
}

function BulkBar({ items, all, onDone, onSelectAll }: { items: Item[]; all: Item[]; onDone: () => void; onSelectAll: () => void }) {
  const spaces = useLive(() => db.spaces.orderBy('order').filter((s) => !s.deletedAt).toArray(), []) ?? [];
  const ids = items.map((i) => i.id);
  const none = ids.length === 0;

  async function move(spaceId: string) {
    await Promise.all(ids.map((id) => updateItem(id, { spaceId: spaceId || null })));
    toast(`Moved ${ids.length} item${ids.length === 1 ? '' : 's'}`);
    onDone();
  }
  async function addTag() {
    const raw = prompt('Tag to add to the selected items');
    const tag = raw ? normalizeTag(raw) : '';
    if (!tag) return;
    const items = await db.items.bulkGet(ids);
    await Promise.all(items.map((i) => i && updateItem(i.id, { tags: [...i.tags, tag] })));
    toast(`Tagged ${ids.length} with #${tag}`);
    onDone();
  }
  // Notes and links aren't tasks, so Done leaves them alone rather than turning them into finished tasks.
  const openTasks = items.filter((i) => i.status === 'todo' || i.status === 'doing');
  async function markDone() {
    // One at a time through setDone, so each repeating task schedules its next one.
    for (const item of openTasks) await setDone(item, true);
    toast(`Marked ${openTasks.length} task${openTasks.length === 1 ? '' : 's'} done`);
    onDone();
  }

  return (
    <div class="fixed z-30 inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 flex justify-center px-3 pointer-events-none">
      <div class="pointer-events-auto card shadow-xl flex items-center gap-1 p-1.5 max-w-full overflow-x-auto">
        <span class="text-sm px-2 whitespace-nowrap tabular-nums">{ids.length} selected</span>
        {ids.length < all.length && (
          <button class="btn btn-ghost" onClick={onSelectAll}>All</button>
        )}
        <label class={`btn btn-ghost relative ${none ? 'opacity-50 pointer-events-none' : ''}`} title="Move to space">
          <Folder size={16} />
          <span class="hidden sm:inline">Move</span>
          <select class="absolute inset-0 opacity-0" aria-label="Move to space" value="" onChange={(e) => move(e.currentTarget.value)}>
            <option value="" disabled>Move to…</option>
            <option value="">No space (Unsorted)</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
            ))}
          </select>
        </label>
        <button class="btn btn-ghost" disabled={none} onClick={addTag} title="Add tag"><Hash size={16} /><span class="hidden sm:inline">Tag</span></button>
        <button class="btn btn-ghost" disabled={!openTasks.length} onClick={markDone} title={openTasks.length ? 'Mark tasks done' : 'No open tasks selected'}><CheckCheck size={16} /><span class="hidden sm:inline">Done</span></button>
        <button class="btn btn-ghost" disabled={none} onClick={() => archiveWithUndo(ids).then(onDone)} title="Archive"><Archive size={16} /></button>
        <button class="btn btn-ghost text-danger" disabled={none} onClick={async () => {
            const ok = await confirmAction({
              title: `Delete ${ids.length} item${ids.length === 1 ? '' : 's'}?`,
              body: `${ids.length === 1 ? 'It moves' : 'They move'} to Trash, where you can restore ${ids.length === 1 ? 'it' : 'them'} for ${TRASH_DAYS} days.`,
              confirmLabel: 'Delete',
            });
            if (ok) await trashWithUndo(ids).then(onDone);
          }} title="Delete"><Trash size={16} /></button>
        <button class="icon-btn" aria-label="Cancel selection" onClick={onDone}><X size={16} /></button>
      </div>
    </div>
  );
}
