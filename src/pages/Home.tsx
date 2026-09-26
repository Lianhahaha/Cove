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

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Section({ title, icon, href, children }: { title: string; icon: ComponentChildren; href?: string; children: ComponentChildren }) {
  return (
    <section>
      <div class="flex items-center justify-between mb-1.5">
        <h2 class="eyebrow flex items-center gap-2">
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
    const counts = new Map<string, number>();
    for (const i of all) if (i.spaceId) counts.set(i.spaceId, (counts.get(i.spaceId) ?? 0) + 1);
    return { due, pinned, recent, counts };
  }, [items]);

  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  return (
    <>
      <PageHeader title={greeting()} subtitle={today} />
      <div class="px-3 md:px-6 py-3 md:py-4 max-w-3xl mx-auto w-full space-y-5 md:space-y-7">
        <QuickAdd />

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
          <Section title="Due today" icon={<CalendarCheck size={13} />} href="/tasks">
            {due.map((i) => (
              <ItemRow key={i.id} item={i} ctx={ctx} />
            ))}
          </Section>
        )}

        {pinned.length > 0 && (
          <Section title="Pinned" icon={<Pin size={13} />}>
            {pinned.map((i) => (
              <ItemRow key={i.id} item={i} ctx={ctx} />
            ))}
          </Section>
        )}

        {spaces && spaces.length > 0 && (
          <section>
            <h2 class="eyebrow mb-2">Spaces</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {spaces.map((s) => (
                <a key={s.id} href={`/s/${s.id}`} class="card p-2.5 flex items-center gap-2.5 hover:border-border2" style={{ borderLeft: `4px solid ${s.color}` }}>
                  <span class="text-lg">{s.emoji}</span>
                  <span class="min-w-0">
                    <span class="block font-medium truncate">{s.name}</span>
                    <span class="block text-xs text-subtle">{counts.get(s.id) ?? 0} items</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {recent.length > 0 && (
          <Section title="Recent" icon={<Clock size={13} />} href="/all">
            {recent.map((i) => (
              <ItemRow key={i.id} item={i} ctx={ctx} />
            ))}
          </Section>
        )}
      </div>
    </>
  );
}
