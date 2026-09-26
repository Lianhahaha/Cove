import { useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { ComponentChildren } from 'preact';
import {
  Archive,
  CalendarRange,
  ChartColumn,
  Clock,
  Hash,
  House,
  Inbox,
  Layers,
  Monitor,
  Moon,
  Download,
  Plus,
  Search,
  Settings,
  SquareCheck,
  Star,
  Sun,
  Tags as TagsIcon,
  Trash,
} from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { isActive, isOpenTask } from '../lib/queries';
import { dueBucket } from '../lib/dates';
import { addSpace, reorderSpaces, updateItem } from '../lib/repo';
import { toast } from '../lib/toast';
import { ITEM_MIME, SPACE_MIME } from '../lib/dnd';
import { themePref, type ThemePref } from '../lib/theme';
import { menuOpen } from '../state';
import { installPrompt, promptInstall } from '../lib/pwa';

function NavLink({ href, icon, label, count, exact }: { href: string; icon: ComponentChildren; label: string; count?: number; exact?: boolean }) {
  const { path } = useLocation();
  const active = exact ? path === href : path === href || path.startsWith(href + '/');
  return (
    <a
      href={href}
      onClick={() => (menuOpen.value = false)}
      aria-current={active ? 'page' : undefined}
      class={`flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-sm transition-colors ${
        active ? 'bg-accent-fill text-accent font-medium' : 'text-muted hover:bg-surface3 hover:text-text'
      }`}
    >
      <span class="shrink-0 w-5 grid place-items-center">{icon}</span>
      <span class="flex-1 truncate">{label}</span>
      {!!count && <span class="text-xs tabular-nums text-subtle">{count}</span>}
    </a>
  );
}

const THEME_NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<ThemePref, string> = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };

export function Nav() {
  const counts = useLive(async () => {
    const items = await db.items.filter((i) => isActive(i)).toArray();
    const now = new Date();
    return {
      inbox: items.filter((i) => i.spaceId === null && i.status !== 'done').length,
      due: items.filter((i) => isOpenTask(i) && ['overdue', 'today'].includes(dueBucket(i.due, i.dueHasTime, now))).length,
    };
  }, []);
  const spaces = useLive(() => db.spaces.orderBy('order').filter((s) => !s.deletedAt && !s.archived).toArray(), []);
  const [adding, setAdding] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  /** Dropping a space reorders the list; dropping an item moves it into the space. */
  async function onDropOnSpace(e: DragEvent, targetId: string) {
    e.preventDefault();
    setDropTarget(null);
    const dt = e.dataTransfer;
    if (!dt || !spaces) return;
    const draggedSpace = dt.getData(SPACE_MIME);
    if (draggedSpace && draggedSpace !== targetId) {
      const ids = spaces.map((s) => s.id).filter((id) => id !== draggedSpace);
      ids.splice(ids.indexOf(targetId), 0, draggedSpace);
      await reorderSpaces(ids);
      return;
    }
    const itemIds = dt.getData(ITEM_MIME);
    if (itemIds) {
      const ids = itemIds.split(',');
      await Promise.all(ids.map((id) => updateItem(id, { spaceId: targetId })));
      toast(`Moved to ${spaces.find((s) => s.id === targetId)?.name ?? 'space'}`);
    }
  }
  const [name, setName] = useState('');
  const busy = useRef(false);
  const { route } = useLocation();

  // Runs on submit and on blur; the ref stops the blur after a submit from adding it twice.
  async function createSpace(e: Event) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const trimmed = name.trim();
    setAdding(false);
    setName('');
    if (!trimmed) {
      busy.current = false;
      return;
    }
    try {
      const space = await addSpace({ name: trimmed });
      menuOpen.value = false;
      route(`/s/${space.id}`);
    } finally {
      busy.current = false;
    }
  }

  const ThemeIcon = themePref.value === 'dark' ? Moon : themePref.value === 'light' ? Sun : Monitor;

  return (
    <nav class="flex flex-col h-full" aria-label="Main">
      <div class="flex items-center gap-2 px-2.5 h-12 md:h-14 shrink-0">
        <img src="/favicon.svg" alt="" width={26} height={26} class="rounded-lg" />
        <span class="font-display font-medium text-xl tracking-tight">Cove</span>
      </div>

      <div class="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        <NavLink href="/" exact icon={<House size={18} />} label="Home" />
        <NavLink href="/search" icon={<Search size={18} />} label="Search" />
        <NavLink href="/inbox" icon={<Inbox size={18} />} label="Inbox" count={counts?.inbox} />
        <NavLink href="/tasks" icon={<SquareCheck size={18} />} label="Tasks" count={counts?.due} />
        <NavLink href="/all" icon={<Layers size={18} />} label="All items" />
        <NavLink href="/favorites" icon={<Star size={18} />} label="Favorites" />
        <NavLink href="/tags" icon={<Hash size={18} />} label="Tags" />

        <div class="pt-5 pb-1 px-2.5">
          <span class="eyebrow">Views</span>
        </div>
        <NavLink href="/view/week" icon={<CalendarRange size={18} />} label="This week" />
        <NavLink href="/view/untagged" icon={<TagsIcon size={18} />} label="Untagged" />
        <NavLink href="/view/recent" icon={<Clock size={18} />} label="Recently edited" />

        <div class="flex items-center justify-between pt-5 pb-1 px-2.5">
          <span class="eyebrow">Spaces</span>
          <button class="icon-btn w-7 h-7" aria-label="New space" title="New space" onClick={() => setAdding(true)}>
            <Plus size={16} />
          </button>
        </div>
        {spaces?.map((s) => (
          <div
            key={s.id}
            draggable
            class={`rounded-lg ${dropTarget === s.id ? 'ring-2 ring-accent' : ''}`}
            onDragStart={(e) => e.dataTransfer?.setData(SPACE_MIME, s.id)}
            onDragOver={(e) => {
              const types = e.dataTransfer?.types ?? [];
              if (types.includes(SPACE_MIME) || types.includes(ITEM_MIME)) {
                e.preventDefault();
                setDropTarget(s.id);
              }
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => onDropOnSpace(e, s.id)}
          >
            <NavLink href={`/s/${s.id}`} icon={<span class="text-base leading-none">{s.emoji}</span>} label={s.name} />
          </div>
        ))}
        {adding && (
          <form onSubmit={createSpace} class="px-1 py-1">
            <input
              class="input h-9 min-h-9 text-sm"
              autoFocus
              placeholder="Subject or project name"
              maxLength={60}
              value={name}
              onInput={(e) => setName(e.currentTarget.value)}
              onBlur={createSpace}
              onKeyDown={(e) => e.key === 'Escape' && (setName(''), setAdding(false))}
            />
          </form>
        )}
        {spaces?.length === 0 && !adding && (
          <button class="w-full text-left px-2.5 py-2 text-sm text-subtle hover:text-text" onClick={() => setAdding(true)}>
            Add your first subject…
          </button>
        )}
      </div>

      <div class="border-t border-border p-2 space-y-0.5 shrink-0">
        {installPrompt.value && (
          <button class="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-sm text-accent bg-accent-fill hover:bg-accent-hover" onClick={() => void promptInstall()}>
            <Download size={18} />
            Install Cove
          </button>
        )}
        <NavLink href="/stats" icon={<ChartColumn size={18} />} label="Stats" />
        <NavLink href="/archive" icon={<Archive size={18} />} label="Archive" />
        <NavLink href="/trash" icon={<Trash size={18} />} label="Trash" />
        <div class="flex items-center gap-1">
          <div class="flex-1">
            <NavLink href="/settings" icon={<Settings size={18} />} label="Settings" />
          </div>
          <button
            class="icon-btn"
            title={THEME_LABEL[themePref.value]}
            aria-label={`${THEME_LABEL[themePref.value]}. Switch theme`}
            onClick={() => (themePref.value = THEME_NEXT[themePref.value])}
          >
            <ThemeIcon size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
}
