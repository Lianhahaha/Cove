import { Hash } from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { isActive } from '../lib/queries';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

export function Tags() {
  const counts = useLive(async () => {
    const map = new Map<string, number>();
    await db.items.filter(isActive).each((i) => i.tags.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1)));
    return [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, []);
  return (
    <>
      <PageHeader title="Tags" />
      <div class="px-4 md:px-6 py-4 max-w-5xl mx-auto">
        {counts?.length === 0 && (
          <EmptyState icon={<Hash size={22} />} title="No tags yet">
            Type <span class="kbd">#tag</span> when capturing, or add tags on any item.
          </EmptyState>
        )}
        <div class="flex flex-wrap gap-2">
          {counts?.map(([t, n]) => (
            <a key={t} href={`/tags/${encodeURIComponent(t)}`} class="chip text-sm py-1 px-3 hover:border-accent hover:text-accent">
              #{t} <span class="text-subtle tabular-nums">{n}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
