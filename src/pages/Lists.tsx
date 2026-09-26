import { Archive, Hash, Inbox as InboxIcon, Layers, Star } from 'lucide-preact';
import { ItemsView } from '../components/ItemsView';
import { EmptyState } from '../components/EmptyState';
import { isActive } from '../lib/queries';
import { db } from '../lib/db';
import { useLive } from '../lib/live';

export function Inbox() {
  return (
    <ItemsView
      title="Inbox"
      subtitle="Everything not filed under a space yet"
      prefKey="inbox"
      showSpace={false}
      filter={(i) => isActive(i) && i.spaceId === null}
      empty={
        <EmptyState icon={<InboxIcon size={22} />} title="Inbox is clear">
          Paste a link or jot a note above. Add <span class="kbd">@space</span> to file it straight away.
        </EmptyState>
      }
    />
  );
}

export function AllItems() {
  return (
    <ItemsView
      title="All items"
      prefKey="all"
      filter={isActive}
      empty={<EmptyState icon={<Layers size={22} />} title="Nothing saved yet">Everything you capture shows up here.</EmptyState>}
    />
  );
}

export function Favorites() {
  return (
    <ItemsView
      title="Favorites"
      prefKey="favorites"
      showQuickAdd={false}
      filter={(i) => isActive(i) && i.favorite}
      empty={<EmptyState icon={<Star size={22} />} title="No favorites">Star an item to keep it here.</EmptyState>}
    />
  );
}

export function ArchivePage() {
  const spaces = useLive(() => db.spaces.filter((s) => s.archived && !s.deletedAt).toArray(), []);
  return (
    <ItemsView
      intro={
        spaces && spaces.length > 0 ? (
          <section>
            <h2 class="label">Archived spaces</h2>
            <div class="flex flex-wrap gap-2">
              {spaces.map((s) => (
                <a key={s.id} href={`/s/${s.id}`} class="chip text-sm py-1 px-3 hover:border-accent">
                  {s.emoji} {s.name}
                </a>
              ))}
            </div>
          </section>
        ) : undefined
      }
      title="Archive"
      subtitle="Out of the way, still searchable"
      prefKey="archive"
      showQuickAdd={false}
      filter={(i) => !i.deletedAt && i.archived}
      empty={<EmptyState icon={<Archive size={22} />} title="Archive is empty">Archive items you’re done with but want to keep.</EmptyState>}
    />
  );
}

export function TagPage({ tag }: { tag: string }) {
  const t = decodeURIComponent(tag);
  return (
    <ItemsView
      title={`#${t}`}
      prefKey="tag"
      deps={[t]}
      filter={(i) => isActive(i) && i.tags.includes(t)}
      empty={<EmptyState icon={<Hash size={22} />} title="No items with this tag" />}
    />
  );
}
