import { Archive, CalendarRange, Clock, FolderInput, Hash, Layers, NotebookPen, Pencil, Star, Tags as TagsIcon, Trash } from 'lucide-preact';
import { useLocation } from 'preact-iso';
import { dueBucket } from '../lib/dates';
import { NotFound } from './NotFound';
import { ItemsView } from '../components/ItemsView';
import { EmptyState } from '../components/EmptyState';
import { NewNoteButton } from '../components/NewNote';
import { isActive, isOpenTask } from '../lib/queries';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { addTag, normalizeTag, removeTag, renameTag } from '../lib/repo';
import { confirmAction } from '../lib/confirm';
import { toast } from '../lib/toast';

/** Items not in any space yet. It was called Inbox, which read like email. */
export function Unsorted() {
  return (
    <ItemsView
      title="Unsorted"
      subtitle="Things you haven’t put in a space yet"
      prefKey="inbox"
      showSpace={false}
      filter={(i) => isActive(i) && i.spaceId === null}
      empty={
        <EmptyState icon={<FolderInput size={22} />} title="Everything is sorted">
          Paste a link or jot a note above. Add <span class="kbd">@space</span> to put it in a space straight away.
        </EmptyState>
      }
    />
  );
}

/** Notes that aren't tasks, shown as cards like a notebook. */
export function Notes() {
  return (
    <ItemsView
      title="Notes"
      subtitle="Lecture notes, drafts and ideas"
      prefKey="notes"
      defaultLayout="grid"
      showQuickAdd={false}
      intro={<NewNoteButton />}
      filter={(i) => isActive(i) && i.kind === 'note' && i.status === 'none'}
      empty={
        <EmptyState icon={<NotebookPen size={22} />} title="No notes yet">
          Write lecture notes, drafts or ideas. Notes support Markdown and work offline.
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
  const { route } = useLocation();

  async function rename() {
    const raw = prompt(`Rename #${t} to`, t);
    const next = raw ? normalizeTag(raw) : '';
    if (!next || next === t) return;
    const ids = await renameTag(t, next);
    route(`/tags/${encodeURIComponent(next)}`, true);
    toast(`Renamed #${t} to #${next} on ${ids.length} item${ids.length === 1 ? '' : 's'}`);
  }

  async function remove() {
    const ok = await confirmAction({
      title: `Remove #${t}?`,
      body: 'The tag comes off every item that has it. The items themselves stay.',
      confirmLabel: 'Remove tag',
    });
    if (!ok) return;
    const ids = await removeTag(t);
    route('/tags', true);
    toast(`Removed #${t} from ${ids.length} item${ids.length === 1 ? '' : 's'}`, { action: { label: 'Undo', run: () => void addTag(ids, t) } });
  }

  return (
    // Keyed so a selection or type filter doesn't carry over from the last tag.
    <ItemsView
      key={t}
      title={`#${t}`}
      prefKey="tag"
      deps={[t]}
      headerActions={
        <>
          <button class="icon-btn" title="Rename tag" aria-label="Rename tag" onClick={() => void rename()}>
            <Pencil size={18} />
          </button>
          <button class="icon-btn hover:text-danger" title="Remove tag from every item" aria-label="Remove tag" onClick={() => void remove()}>
            <Trash size={18} />
          </button>
        </>
      }
      filter={(i) => isActive(i) && i.tags.includes(t)}
      empty={<EmptyState icon={<Hash size={22} />} title="No items with this tag" />}
    />
  );
}

const WEEK = 7 * 86_400_000;

/** Saved filters that cut across spaces. */
const VIEWS = {
  week: {
    title: 'This week',
    subtitle: 'Open tasks that are overdue or due in the next 7 days',
    filter: (i: Parameters<typeof isActive>[0]) => isOpenTask(i) && ['overdue', 'today', 'tomorrow', 'week'].includes(dueBucket(i.due, i.dueHasTime)),
    empty: <EmptyState icon={<CalendarRange size={22} />} title="Nothing due this week">Enjoy it.</EmptyState>,
  },
  untagged: {
    title: 'No tags',
    // Spaces aren't tags, so something in a space still shows here until it gets a tag.
    subtitle: 'Items without tags. A space isn’t a tag, so filed items can show here too.',
    filter: (i: Parameters<typeof isActive>[0]) => isActive(i) && i.tags.length === 0,
    empty: <EmptyState icon={<TagsIcon size={22} />} title="Everything is tagged" />,
  },
  recent: {
    title: 'Recently edited',
    subtitle: 'Changed in the last 7 days',
    filter: (i: Parameters<typeof isActive>[0]) => isActive(i) && i.updatedAt > Date.now() - WEEK,
    empty: <EmptyState icon={<Clock size={22} />} title="Nothing edited this week" />,
  },
} as const;

export type ViewName = keyof typeof VIEWS;
export const VIEW_NAMES = Object.keys(VIEWS) as ViewName[];
export const VIEW_TITLES = Object.fromEntries(VIEW_NAMES.map((v) => [v, VIEWS[v].title])) as Record<ViewName, string>;

export function SmartView({ name }: { name: string }) {
  if (!(VIEW_NAMES as string[]).includes(name)) return <NotFound />;
  const v = VIEWS[name as ViewName];
  return <ItemsView key={name} title={v.title} subtitle={v.subtitle} prefKey={`view-${name}`} deps={[name]} showQuickAdd={false} filter={v.filter} empty={v.empty} />;
}
