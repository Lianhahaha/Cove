import { useMemo, useState } from 'preact/hooks';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Columns3, List, SquareCheck } from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { usePref } from '../lib/prefs';
import { addDays, BUCKET_LABELS, dueBucket, sameDay, startOfDay, type DueBucket } from '../lib/dates';
import { displayTitle, isActive, sortItems } from '../lib/queries';
import { useCardContext } from '../lib/useCardContext';
import { setDone } from '../lib/actions';
import { updateItem } from '../lib/repo';
import { ITEM_MIME } from '../lib/dnd';
import { openCapture } from '../state';
import { downloadIcs } from '../lib/ics';
import { toast } from '../lib/toast';
import type { Item, TaskStatus } from '../lib/types';
import { ItemRow, type CardContext } from '../components/ItemCard';
import { PageHeader } from '../components/PageHeader';
import { QuickAdd } from '../components/QuickAdd';
import { EmptyState } from '../components/EmptyState';

type View = 'list' | 'board' | 'calendar';
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BUCKETS: DueBucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'none'];
const VIEWS: { id: View; label: string; icon: typeof List }[] = [
  { id: 'list', label: 'List', icon: List },
  { id: 'board', label: 'Board', icon: Columns3 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
];

export function Tasks() {
  const [view, setView] = usePref<View>('tasks:view', 'list');
  const [spaceFilter, setSpaceFilter] = usePref<string>('tasks:space', 'all');
  const [showDone, setShowDone] = usePref<boolean>('tasks:showDone', false);
  const tasks = useLive(() => db.items.filter((i) => isActive(i) && i.status !== 'none').toArray(), []);
  const spaces = useLive(() => db.spaces.orderBy('order').filter((s) => !s.deletedAt).toArray(), []) ?? [];
  const ctx = useCardContext(spaceFilter === 'all');

  const filtered = useMemo(
    () => (tasks ?? []).filter((t) => spaceFilter === 'all' || (spaceFilter === 'inbox' ? t.spaceId === null : t.spaceId === spaceFilter)),
    [tasks, spaceFilter],
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        actions={
          <>
          <button
            class="icon-btn"
            title="Export deadlines to your calendar (.ics)"
            aria-label="Export deadlines to your calendar"
            onClick={() => {
              const upcoming = filtered.filter((t) => t.status !== 'done' && t.due !== null);
              if (!upcoming.length) return toast('No open tasks with due dates to export');
              downloadIcs(upcoming, 'Cove deadlines');
            }}
          >
            <CalendarPlus size={18} />
          </button>
          <div class="flex gap-0.5 p-0.5 rounded-lg bg-surface3" role="tablist" aria-label="View">
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                title={label}
                class={`h-8 px-2.5 rounded-md flex items-center gap-1.5 text-sm ${view === id ? 'bg-surface shadow-sm text-text' : 'text-subtle'}`}
                onClick={() => setView(id)}
              >
                <Icon size={16} />
                <span class="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          </>
        }
      />
      <div class={`px-4 md:px-6 py-4 mx-auto w-full space-y-4 ${view === 'list' ? 'max-w-3xl' : 'max-w-6xl'}`}>
        <QuickAdd
          extra={{ status: 'todo' }}
          defaultSpaceId={spaceFilter !== 'all' && spaceFilter !== 'inbox' ? spaceFilter : null}
          placeholder="Add a task…"
        />
        <div class="flex items-center gap-3 flex-wrap text-sm">
          <select class="input w-auto min-h-8 h-8 py-0" value={spaceFilter} onChange={(e) => setSpaceFilter(e.currentTarget.value)} aria-label="Filter by space">
            <option value="all">All spaces</option>
            <option value="inbox">Inbox only</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
            ))}
          </select>
          {view === 'list' && (
            <label class="flex items-center gap-2 text-muted cursor-pointer">
              <input type="checkbox" class="w-4 h-4 accent-[var(--c-accent)]" checked={showDone} onChange={(e) => setShowDone(e.currentTarget.checked)} />
              Show done
            </label>
          )}
        </div>

        {tasks !== undefined && tasks.length === 0 ? (
          <EmptyState icon={<SquareCheck size={22} />} title="No tasks yet">
            Type something with a date, like <span class="kbd">quiz thu</span>, or open any item and make it a task.
          </EmptyState>
        ) : view === 'list' ? (
          <TaskList tasks={filtered} ctx={ctx} showDone={showDone} />
        ) : view === 'board' ? (
          <Board tasks={filtered} ctx={ctx} />
        ) : (
          <Calendar tasks={filtered} ctx={ctx} />
        )}
      </div>
    </>
  );
}

function TaskList({ tasks, ctx, showDone }: { tasks: Item[]; ctx: CardContext; showDone: boolean }) {
  const groups = useMemo(() => {
    const now = new Date();
    const map = new Map<DueBucket, Item[]>();
    for (const t of tasks) {
      if (t.status === 'done') continue;
      const b = dueBucket(t.due, t.dueHasTime, now);
      map.set(b, [...(map.get(b) ?? []), t]);
    }
    return BUCKETS.filter((b) => map.has(b)).map((b) => [b, sortItems(map.get(b)!, 'due')] as const);
  }, [tasks]);
  const done = useMemo(() => tasks.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)), [tasks]);

  if (!groups.length && !(showDone && done.length)) {
    return <p class="text-sm text-subtle py-8 text-center">All caught up. Nothing left to do here.</p>;
  }
  return (
    <div class="space-y-6">
      {groups.map(([bucket, items]) => (
        <section key={bucket}>
          <h2 class={`text-sm font-semibold mb-1 ${bucket === 'overdue' ? 'text-danger' : bucket === 'today' ? 'text-accent' : 'text-subtle'}`}>
            {BUCKET_LABELS[bucket]} <span class="font-normal text-subtle">{items.length}</span>
          </h2>
          <div class="-mx-3 space-y-0.5">
            {items.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} />)}
          </div>
        </section>
      ))}
      {showDone && done.length > 0 && (
        <section>
          <h2 class="text-sm font-semibold mb-1 text-subtle">Done <span class="font-normal">{done.length}</span></h2>
          <div class="-mx-3 space-y-0.5">
            {done.slice(0, 100).map((i) => <ItemRow key={i.id} item={i} ctx={ctx} />)}
          </div>
        </section>
      )}
    </div>
  );
}

const COLUMNS: { status: Exclude<TaskStatus, 'none'>; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'doing', label: 'Doing' },
  { status: 'done', label: 'Done' },
];

function Board({ tasks, ctx }: { tasks: Item[]; ctx: CardContext }) {
  const [over, setOver] = useState<string | null>(null);
  const columns = useMemo(
    () =>
      COLUMNS.map((c) => ({
        ...c,
        items: tasks
          .filter((t) => t.status === c.status)
          .sort((a, b) => (c.status === 'done' ? (b.completedAt ?? 0) - (a.completedAt ?? 0) : a.order - b.order)),
      })),
    [tasks],
  );

  /** Drops onto a column, or before a card when `beforeId` is set. */
  async function drop(e: DragEvent, status: Exclude<TaskStatus, 'none'>, beforeId?: string) {
    e.preventDefault();
    e.stopPropagation();
    setOver(null);
    const ids = e.dataTransfer?.getData(ITEM_MIME)?.split(',').filter(Boolean) ?? [];
    // Letting go of a card where it started (on itself) isn't a move.
    if (beforeId && ids.includes(beforeId)) return;
    const col = columns.find((c) => c.status === status)!.items.filter((i) => !ids.includes(i.id));
    const idx = beforeId ? col.findIndex((i) => i.id === beforeId) : col.length;
    const prev = col[idx - 1]?.order;
    const next = col[idx]?.order;
    for (const [n, id] of ids.entries()) {
      const item = tasks.find((t) => t.id === id);
      if (!item) continue;
      // Place between the neighbors so no other card has to be renumbered.
      let order: number;
      if (prev !== undefined && next !== undefined) order = prev + ((next - prev) * (n + 1)) / (ids.length + 1);
      else if (prev !== undefined) order = prev + 1 + n;
      else if (next !== undefined) order = next - (ids.length - n);
      else order = Date.now() + n;
      if (status === 'done' && item.status !== 'done') await setDone(item, true);
      // Leaving Done goes through setDone too, so a repeat it scheduled is taken back.
      if (status !== 'done' && item.status === 'done') await setDone(item, false);
      await updateItem(id, status === 'done' ? { order } : { status, order, completedAt: null });
    }
  }

  return (
    <div class="-mx-4 md:mx-0 px-4 md:px-0 flex md:grid md:grid-cols-3 gap-3 overflow-x-auto snap-x snap-mandatory pb-2">
      {columns.map((c) => (
        <section
          key={c.status}
          class={`snap-start shrink-0 w-[85vw] xs:w-80 md:w-auto rounded-2xl bg-surface2 border p-2 flex flex-col min-h-64 ${over === c.status ? 'border-accent' : 'border-border'}`}
          onDragOver={(e) => {
            if (e.dataTransfer?.types.includes(ITEM_MIME)) {
              e.preventDefault();
              setOver(c.status);
            }
          }}
          onDragLeave={(e) => !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node) && setOver(null)}
          onDrop={(e) => drop(e, c.status)}
          aria-label={c.label}
        >
          <h2 class="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">
            {c.label}
            <span class="text-subtle font-normal tabular-nums">{c.items.length}</span>
          </h2>
          <div class="space-y-2 flex-1">
            {c.items.slice(0, c.status === 'done' ? 30 : undefined).map((i) => (
              <div key={i.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, c.status, i.id)}>
                <BoardCard item={i} ctx={ctx} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BoardCard({ item, ctx }: { item: Item; ctx: CardContext }) {
  return (
    <div class="card shadow-sm">
      <ItemRow item={item} ctx={ctx} />
    </div>
  );
}

function Calendar({ tasks, ctx }: { tasks: Item[]; ctx: CardContext }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));
  const today = startOfDay(new Date());

  // Six weeks starting on the Sunday on or before the 1st.
  const days = useMemo(() => {
    const first = addDays(month, -month.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<number, Item[]>();
    for (const t of tasks) {
      if (t.due === null) continue;
      const key = startOfDay(t.due).getTime();
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    for (const list of map.values()) list.sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.due ?? 0) - (b.due ?? 0));
    return map;
  }, [tasks]);

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month);
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(2026, 0, 4 + i)));
  const selectedItems = byDay.get(selected.getTime()) ?? [];
  const selectedLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(selected);

  return (
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <h2 class="font-semibold text-lg flex-1">{monthLabel}</h2>
        <button class="btn" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(startOfDay(d)); }}>Today</button>
        <button class="icon-btn" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
        <button class="icon-btn" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
      </div>
      <div class="card overflow-hidden">
        <div class="grid grid-cols-7 text-xs text-subtle border-b border-border">
          {weekdays.map((w) => <div key={w} class="px-2 py-1.5 text-center">{w}</div>)}
        </div>
        <div class="grid grid-cols-7">
          {days.map((d) => {
            const items = byDay.get(d.getTime()) ?? [];
            const inMonth = d.getMonth() === month.getMonth();
            const isToday = sameDay(d, today);
            const isSel = sameDay(d, selected);
            return (
              <div
                key={d.getTime()}
                role="button"
                tabIndex={0}
                aria-label={`${d.toDateString()}, ${items.length} tasks`}
                aria-pressed={isSel}
                onClick={() => setSelected(d)}
                onKeyDown={(e) => e.key === 'Enter' && setSelected(d)}
                onDragOver={(e) => e.dataTransfer?.types.includes(ITEM_MIME) && e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const ids = e.dataTransfer?.getData(ITEM_MIME)?.split(',') ?? [];
                  for (const id of ids) {
                    const t = tasks.find((x) => x.id === id);
                    if (!t) continue;
                    // Keep the time of day when moving to another date.
                    const time = t.due !== null && t.dueHasTime ? new Date(t.due) : null;
                    const due = time ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), time.getHours(), time.getMinutes()).getTime() : d.getTime();
                    // The reminder moves with the task, keeping the same distance before it.
                    const remindAt = t.remindAt !== null && t.due !== null ? due - (t.due - t.remindAt) : t.remindAt;
                    await updateItem(id, { due, remindAt });
                  }
                }}
                class={`min-h-16 sm:min-h-24 border-b border-r border-border p-1 text-left cursor-pointer ${inMonth ? '' : 'bg-surface2/60 text-subtle'} ${isSel ? 'bg-accent-fill/60' : 'hover:bg-surface3/50'}`}
              >
                <div class={`text-xs w-6 h-6 grid place-items-center rounded-full ${isToday ? 'bg-accent text-on-accent font-semibold' : ''}`}>{d.getDate()}</div>
                <div class="hidden sm:block space-y-0.5 mt-0.5">
                  {items.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer?.setData(ITEM_MIME, t.id)}
                      class={`block w-full text-left truncate text-[11px] leading-tight px-1 py-0.5 rounded bg-surface3 ${t.status === 'done' ? 'line-through text-subtle' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        ctx.onOpen(t.id);
                      }}
                    >
                      {displayTitle(t)}
                    </button>
                  ))}
                  {items.length > 3 && <p class="text-[11px] text-subtle px-1">+{items.length - 3} more</p>}
                </div>
                {items.length > 0 && (
                  <div class="sm:hidden flex gap-0.5 mt-1 justify-center">
                    {items.slice(0, 4).map((t) => <span key={t.id} class={`w-1.5 h-1.5 rounded-full ${t.status === 'done' ? 'bg-border2' : 'bg-accent'}`} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <section>
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-sm font-semibold text-subtle">{selectedLabel}</h3>
          <button
            class="btn btn-soft min-h-8"
            // Written with the year so a past day isn't read as next year's.
            onClick={() => openCapture({ text: `${MONTHS_EN[selected.getMonth()]} ${selected.getDate()} ${selected.getFullYear()} ` })}
          >
            Add task
          </button>
        </div>
        {selectedItems.length === 0 ? (
          <p class="text-sm text-subtle py-3">Nothing due.</p>
        ) : (
          <div class="-mx-3 space-y-0.5">
            {selectedItems.map((i) => <ItemRow key={i.id} item={i} ctx={ctx} />)}
          </div>
        )}
      </section>
    </div>
  );
}
