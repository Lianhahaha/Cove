import { useMemo } from 'preact/hooks';
import { ArchiveRestore, Trash as TrashIcon } from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { emptyTrash, purgeItems, restoreItems, restoreSpace, TRASH_DAYS } from '../lib/repo';
import { displayTitle } from '../lib/queries';
import { timeAgo } from '../lib/dates';
import { toast } from '../lib/toast';
import { confirmAction } from '../lib/confirm';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

const DAY = 86_400_000;

export function Trash() {
  const items = useLive(() => db.items.where('deletedAt').above(0).toArray(), []);
  const spaces = useLive(() => db.spaces.where('deletedAt').above(0).toArray(), []) ?? [];

  const sorted = useMemo(() => [...(items ?? [])].sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)), [items]);
  const daysLeft = (deletedAt: number) => Math.max(0, Math.ceil((deletedAt + TRASH_DAYS * DAY - Date.now()) / DAY));

  async function empty() {
    const total = sorted.length + spaces.length;
    const ok = await confirmAction({
      title: 'Empty the trash?',
      body: `${total} thing${total === 1 ? '' : 's'} will be deleted for good. This can’t be undone.`,
      confirmLabel: 'Delete all for good',
    });
    if (!ok) return;
    const n = await emptyTrash();
    await db.spaces.bulkDelete(spaces.map((s) => s.id));
    toast(`Deleted ${n} item${n === 1 ? '' : 's'} for good`);
  }

  async function purge(id: string, title: string) {
    const ok = await confirmAction({ title: 'Delete for good?', body: `“${title}” will be gone for good. This can’t be undone.`, confirmLabel: 'Delete for good' });
    if (!ok) return;
    await purgeItems([id]);
    toast('Deleted for good');
  }

  return (
    <>
      <PageHeader
        title="Trash"
        subtitle={`Items are deleted for good after ${TRASH_DAYS} days`}
        actions={
          (sorted.length > 0 || spaces.length > 0) && (
            <button class="btn" onClick={() => void empty()}>Empty trash</button>
          )
        }
      />
      <div class="px-3 md:px-6 py-3 md:py-4 max-w-3xl mx-auto w-full space-y-6">
        {items !== undefined && sorted.length === 0 && spaces.length === 0 && (
          <EmptyState icon={<TrashIcon size={22} />} title="Trash is empty">
            Deleted items stay here for {TRASH_DAYS} days in case you change your mind.
          </EmptyState>
        )}

        {spaces.length > 0 && (
          <section>
            <h2 class="label">Spaces</h2>
            <div class="space-y-1">
              {spaces.map((s) => (
                <div key={s.id} class="card flex items-center gap-3 px-3 py-2">
                  <span class="text-lg">{s.emoji}</span>
                  <span class="flex-1 truncate font-medium">{s.name}</span>
                  <button
                    class="btn btn-ghost"
                    onClick={async () => {
                      const n = await restoreSpace(s.id);
                      toast(`Restored ${s.name}${n ? ` and ${n} item${n === 1 ? '' : 's'}` : ''}`);
                    }}
                  >
                    <ArchiveRestore size={16} /> Restore
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {sorted.length > 0 && (
          <section class="space-y-1">
            {spaces.length > 0 && <h2 class="label">Items</h2>}
            {sorted.map((i) => (
              <div key={i.id} class="card flex items-center gap-3 px-3 py-2">
                <div class="min-w-0 flex-1">
                  <p class="font-medium truncate">{displayTitle(i)}</p>
                  <p class="text-xs text-subtle">
                    Deleted {timeAgo(i.deletedAt!)} · {daysLeft(i.deletedAt!)} days left
                  </p>
                </div>
                <button class="btn btn-ghost" onClick={() => restoreItems([i.id]).then(() => toast('Restored'))}>
                  <ArchiveRestore size={16} /> <span class="hidden sm:inline">Restore</span>
                </button>
                <button
                  class="icon-btn text-danger"
                  aria-label={`Delete ${displayTitle(i)} for good`}
                  title="Delete for good"
                  onClick={() => void purge(i.id, displayTitle(i))}
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
