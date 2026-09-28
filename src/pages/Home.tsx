import { useMemo } from 'preact/hooks';
import { CalendarCheck, Clock, Pin, Sparkles } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { dueBucket } from '../lib/dates';
import { isActive, isOpenTask, sortItems } from '../lib/queries';
import { useCardContext } from '../lib/useCardContext';
import { ItemRow } from '../components/ItemCard';
import { PageHeader } from '../components/PageHeader';
import { QuickAdd } from '../components/QuickAdd';
import { EmptyState } from '../components/EmptyState';
import { QuickLinks } from '../components/QuickLinks';
import { InfoTip } from '../components/InfoTip';

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Section({ title, icon, href, children }: { title: string; icon: ComponentChildren; href?: string; children: ComponentChildren }) {
  return (
    <section>
      <div class="flex items-center justify-between mb-1.5">
        <h2 class="section-title flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {href && (
          <a class="text-sm text-accent hover:underline" href={href}>
            See all
          </a>
        )}
      </div>
      <div class="-mx-3 space-y-0.5">{children}</div>
    </section>
  );
}

export function Home() {
  const items = useLive(() => db.items.filter(isActive).toArray(), []);
  const spaces = useLive(() => db.spaces.orderBy('order').filter((s) => !s.deletedAt && !s.archived).toArray(), []);
  const ctx = useCardContext(true);

  const { due, pinned, recent, counts } = useMemo(() => {
    const all = items ?? [];
    const now = new Date();
    const due = sortItems(
      all.filter((i) => isOpenTask(i) && ['overdue', 'today'].includes(dueBucket(i.due, i.dueHasTime, now))),
      'due',
    );
    const dueIds = new Set(due.map((i) => i.id));
    const pinned = sortItems(all.filter((i) => i.pinned && !dueIds.has(i.id)), 'recent');
    const recent = sortItems(all.filter((i) => !i.pinned && !dueIds.has(i.id)), 'recent').slice(0, 8);
    const counts = new Map<string, { items: number; open: number; overdue: number }>();
    for (const i of all) {
      if (!i.spaceId) continue;
      const c = counts.get(i.spaceId) ?? { items: 0, open: 0, overdue: 0 };
      c.items++;
      if (isOpenTask(i)) {
        c.open++;
        if (dueBucket(i.due, i.dueHasTime, now) === 'overdue') c.overdue++;
      }
      counts.set(i.spaceId, c);
    }
    return { due, pinned, recent, counts };
  }, [items]);

  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  return (
    <>
      <PageHeader title={greeting()} subtitle={today} />
      <div class="px-3 md:px-6 py-3 md:py-4 max-w-3xl mx-auto w-full space-y-5 md:space-y-7">
        <QuickAdd />

        <QuickLinks />

        {items !== undefined && items.length === 0 && (
          <EmptyState icon={<Sparkles size={22} />} title="Welcome to Cove">
            <p>Paste a link, write a note, or type a task like</p>
            <p class="mt-2">
              <span class="kbd">Lab report fri 11:59pm #lab !!</span>
            </p>
            <p class="mt-3">Create a space for each subject from the menu.</p>
          </EmptyState>
        )}

        {due.length > 0 && (
          <Section title="Due today" icon={<CalendarCheck size={15} class="text-subtle" />} href="/tasks">
            {due.map((i) => (
              <ItemRow key={i.id} item={i} ctx={ctx} />
            ))}
          </Section>
        )}

        {pinned.length > 0 && (
          <Section title="Pinned" icon={<Pin size={15} class="text-subtle" />}>
            {pinned.map((i) => (
              <ItemRow key={i.id} item={i} ctx={ctx} />
            ))}
          </Section>
        )}

        {spaces && spaces.length > 0 && (
          <section>
            <div class="flex items-center gap-1.5 mb-2">
              <h2 class="section-title">Spaces</h2>
              <InfoTip label="Spaces">A space holds everything for one subject or project: links, notes, files and tasks. Anything without a space waits in Unsorted.</InfoTip>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {spaces.map((s) => {
                const c = counts.get(s.id) ?? { items: 0, open: 0, overdue: 0 };
                return (
                <a key={s.id} href={`/s/${s.id}`} class="card p-2.5 flex items-center gap-2.5 hover:border-border2 transition-colors">
                  {/* The space's color tints the tile behind its emoji. */}
                  <span
                    class="w-9 h-9 shrink-0 grid place-items-center rounded-[0.625rem] text-lg"
                    style={{ background: `color-mix(in oklab, ${s.color} 24%, transparent)` }}
                  >
                    {s.emoji}
                  </span>
                  <span class="min-w-0">
                    <span class="block font-[450] truncate">{s.name}</span>
                    <span class="block text-xs text-subtle tabular-nums truncate">
                      {c.items} {c.items === 1 ? 'item' : 'items'}
                      {/* What's left to do in the subject, with anything late called out. */}
                      {c.overdue > 0 ? <span class="text-danger"> · {c.overdue} overdue</span> : c.open > 0 ? ` · ${c.open} to do` : ''}
                    </span>
                  </span>
                </a>
                );
              })}
            </div>
          </section>
        )}

        {recent.length > 0 && (
          <Section title="Recent" icon={<Clock size={15} class="text-subtle" />} href="/all">
            {recent.map((i) => (
              <ItemRow key={i.id} item={i} ctx={ctx} />
            ))}
          </Section>
        )}
      </div>
    </>
  );
}
