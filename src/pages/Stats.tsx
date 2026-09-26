import { useMemo, useState } from 'preact/hooks';
import { ChartColumn } from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { dueBucket } from '../lib/dates';
import { isOpenTask } from '../lib/queries';
import { finishedPerDay, sinceDays, streak } from '../lib/stats';
import { focusLog } from '../lib/focus';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div class="card p-4">
      <p class="eyebrow">{label}</p>
      <p class="font-display text-3xl font-medium tabular-nums mt-1">{value}</p>
      {note && <p class="text-xs text-subtle mt-1">{note}</p>}
    </div>
  );
}

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const shortDay = new Intl.DateTimeFormat(undefined, { day: 'numeric' });

/** One series, so no legend: the heading names it. Hover or focus a bar for its value. */
function FinishedChart({ series }: { series: { date: Date; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...series.map((d) => d.count));
  const total = series.reduce((n, d) => n + d.count, 0);
  const H = 140;

  return (
    <section class="card p-4 sm:p-5">
      <div class="flex items-baseline justify-between gap-2 mb-4">
        <div>
          <h2 class="font-display font-medium">Tasks finished</h2>
          <p class="text-xs text-subtle">Last 14 days · {total} in total</p>
        </div>
        <button class="text-xs text-subtle underline" onClick={() => setAsTable(!asTable)}>
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-subtle text-xs">
              <th class="font-medium py-1">Day</th>
              <th class="font-medium py-1 text-right">Finished</th>
            </tr>
          </thead>
          <tbody>
            {series.map((d) => (
              <tr key={d.date.getTime()} class="border-t border-border">
                <td class="py-1">{dayFmt.format(d.date)}</td>
                <td class="py-1 text-right tabular-nums">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div class="relative">
          <div class="flex items-end gap-[2px] border-b border-border2" style={{ height: H }} role="img" aria-label={`Tasks finished per day for the last 14 days, ${total} in total`}>
            {series.map((d, i) => {
              const h = d.count ? Math.max(6, (d.count / max) * (H - 24)) : 0;
              return (
                <div
                  key={d.date.getTime()}
                  // The hit target is the whole column, wider and taller than the bar.
                  class="flex-1 h-full flex flex-col justify-end items-center cursor-default outline-none"
                  tabIndex={0}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${dayFmt.format(d.date)}: ${d.count} finished`}
                >
                  <div
                    class={`w-full max-w-7 rounded-t-[4px] ${hover === i ? 'opacity-100' : hover === null ? 'opacity-100' : 'opacity-60'}`}
                    style={{ height: h, background: 'var(--c-chart)' }}
                  />
                </div>
              );
            })}
          </div>
          <div class="flex gap-[2px] mt-1.5">
            {series.map((d, i) => (
              <span key={d.date.getTime()} class="flex-1 text-center text-[10px] text-subtle tabular-nums">
                {i % 2 === 1 || i === series.length - 1 ? shortDay.format(d.date) : ''}
              </span>
            ))}
          </div>
          {hover !== null && (
            <div
              class="absolute -top-2 -translate-x-1/2 -translate-y-full card shadow-lg px-2.5 py-1.5 text-xs pointer-events-none whitespace-nowrap"
              style={{ left: `${((hover + 0.5) / series.length) * 100}%` }}
              role="tooltip"
            >
              <span class="text-subtle">{dayFmt.format(series[hover].date)}</span>
              <span class="font-semibold tabular-nums ml-2">{series[hover].count}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function Stats() {
  const items = useLive(() => db.items.filter((i) => !i.deletedAt).toArray(), []);
  const spaces = useLive(() => db.spaces.orderBy('order').filter((s) => !s.deletedAt).toArray(), []) ?? [];
  const log = useLive(() => focusLog(), []) ?? [];
  const weekAgo = Date.now() - 7 * 86_400_000;
  const focusWeek = log.filter((f) => f.at >= weekAgo).reduce((n, f) => n + f.minutes, 0);

  const data = useMemo(() => {
    const all = items ?? [];
    const open = all.filter(isOpenTask);
    const bySpace = new Map<string | null, { items: number; open: number }>();
    for (const i of all) {
      const row = bySpace.get(i.spaceId) ?? { items: 0, open: 0 };
      row.items++;
      if (isOpenTask(i)) row.open++;
      bySpace.set(i.spaceId, row);
    }
    return {
      total: all.length,
      addedWeek: sinceDays(all, 'createdAt', 7),
      doneWeek: sinceDays(all, 'completedAt', 7),
      streak: streak(all),
      open: open.length,
      overdue: open.filter((i) => dueBucket(i.due, i.dueHasTime) === 'overdue').length,
      series: finishedPerDay(all),
      kinds: { link: all.filter((i) => i.kind === 'link').length, note: all.filter((i) => i.kind === 'note').length, file: all.filter((i) => i.kind === 'file').length },
      bySpace,
    };
  }, [items]);

  const rows = [
    { id: null as string | null, name: 'Inbox', emoji: '📥' },
    ...spaces.map((s) => ({ id: s.id as string | null, name: s.name, emoji: s.emoji })),
  ].filter((r) => data.bySpace.has(r.id));
  const maxItems = Math.max(1, ...rows.map((r) => data.bySpace.get(r.id)!.items));

  return (
    <>
      <PageHeader title="Stats" subtitle="Everything here is counted on this device" />
      <div class="px-4 md:px-6 py-4 max-w-3xl mx-auto w-full space-y-4">
        {items !== undefined && items.length === 0 ? (
          <EmptyState icon={<ChartColumn size={22} />} title="Nothing to count yet">Save a few things and finish a task or two.</EmptyState>
        ) : (
          <>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tile label="Streak" value={`${data.streak}d`} note="days in a row finishing tasks" />
              <Tile label="Done this week" value={data.doneWeek} />
              <Tile label="Open tasks" value={data.open} note={data.overdue ? `${data.overdue} overdue` : 'none overdue'} />
              <Tile label="Saved" value={data.total} note={`${data.addedWeek} this week`} />
            </div>
            {focusWeek > 0 && (
              <p class="text-sm text-muted">
                You focused for <span class="font-semibold text-text tabular-nums">{focusWeek >= 60 ? `${Math.floor(focusWeek / 60)}h ${focusWeek % 60}m` : `${focusWeek} min`}</span> this week.
              </p>
            )}

            <FinishedChart series={data.series} />

            <section class="card p-4 sm:p-5">
              <h2 class="font-display font-medium mb-3">By space</h2>
              <div class="space-y-2.5">
                {rows.map((r) => {
                  const row = data.bySpace.get(r.id)!;
                  return (
                    <div key={r.id ?? 'inbox'} class="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                      <span class="truncate">
                        {r.emoji} {r.name}
                      </span>
                      <div class="h-2 rounded-full bg-surface3 overflow-hidden">
                        <div class="h-full rounded-full" style={{ width: `${(row.items / maxItems) * 100}%`, background: 'var(--c-chart)' }} />
                      </div>
                      <span class="tabular-nums text-muted text-xs w-24 text-right">
                        {row.items} items{row.open ? ` · ${row.open} open` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p class="text-xs text-subtle mt-4">
                {data.kinds.link} links · {data.kinds.note} notes · {data.kinds.file} files
              </p>
            </section>
          </>
        )}
      </div>
    </>
  );
}
