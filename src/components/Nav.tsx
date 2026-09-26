import { useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { ComponentChildren } from 'preact';
import {
  Archive,
  ChartColumn,
  Hash,
  House,
  Inbox,
  Layers,
  Monitor,
  Moon,
  Plus,
  Settings,
  SquareCheck,
  Star,
  Sun,
  Trash,
} from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { isActive, isOpenTask } from '../lib/queries';
import { dueBucket } from '../lib/dates';
import { addSpace } from '../lib/repo';
import { themePref, type ThemePref } from '../lib/theme';
import { menuOpen } from '../state';

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
      <div class="flex items-center gap-2 px-2.5 h-14 shrink-0">
        <img src="/favicon.svg" alt="" width={26} height={26} class="rounded-lg" />
        <span class="font-semibold text-lg tracking-tight">Cove</span>
      </div>

      <div class="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        <NavLink href="/" exact icon={<House size={18} />} label="Home" />
        <NavLink href="/inbox" icon={<Inbox size={18} />} label="Inbox" count={counts?.inbox} />
        <NavLink href="/tasks" icon={<SquareCheck size={18} />} label="Tasks" count={counts?.due} />
        <NavLink href="/all" icon={<Layers size={18} />} label="All items" />
        <NavLink href="/favorites" icon={<Star size={18} />} label="Favorites" />
        <NavLink href="/tags" icon={<Hash size={18} />} label="Tags" />

        <div class="flex items-center justify-between pt-5 pb-1 px-2.5">
          <span class="text-xs font-semibold uppercase tracking-wider text-subtle">Spaces</span>
          <button class="icon-btn w-7 h-7" aria-label="New space" title="New space" onClick={() => setAdding(true)}>
            <Plus size={16} />
          </button>
        </div>
        {spaces?.map((s) => (
          <NavLink key={s.id} href={`/s/${s.id}`} icon={<span class="text-base leading-none">{s.emoji}</span>} label={s.name} />
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
