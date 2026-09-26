import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { ComponentChildren } from 'preact';
import { Archive, ChartColumn, Timer, CornerDownLeft, FolderInput, Hash, House, Layers, Moon, NotebookPen, Plus, Search, Settings, SquareCheck, Star, Trash } from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { search, searchIndex, startSearchIndex } from '../lib/search';
import { displayTitle } from '../lib/queries';
import { themePref } from '../lib/theme';
import { openCapture, paletteOpen } from '../state';
import type { Item } from '../lib/types';
import { VIEW_NAMES, VIEW_TITLES } from '../pages/Lists';
import { startFocus } from '../lib/focus';
import { createNote } from '../lib/notes';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: ComponentChildren;
  run: () => void;
}

const matches = (label: string, q: string) => q.split(/\s+/).every((w) => label.toLowerCase().includes(w));

export function Palette() {
  if (!paletteOpen.value) return null;
  return <PaletteBody />;
}

function PaletteBody() {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const { route, path } = useLocation();
  const spaces = useLive(() => db.spaces.orderBy('order').filter((s) => !s.deletedAt).toArray(), []) ?? [];
  const close = () => (paletteOpen.value = false);

  useEffect(() => {
    startSearchIndex();
    input.current?.focus();
  }, []);

  const go = (href: string) => () => route(href);
  const commands: Command[] = useMemo(
    () => [
      { id: 'new', label: 'New item', hint: 'N', icon: <Plus size={16} />, run: () => openCapture() },
      {
        id: 'new-note',
        label: 'New note',
        icon: <NotebookPen size={16} />,
        // Inside a space, the note lands in that space.
        run: () => void createNote(path.startsWith('/s/') ? path.slice(3) : null).then((n) => route(`${path}?item=${n.id}`)),
      },
      { id: 'notes', label: 'Go to Notes', icon: <NotebookPen size={16} />, run: go('/notes') },
      { id: 'home', label: 'Go to Home', icon: <House size={16} />, run: go('/') },
      { id: 'unsorted', label: 'Go to Unsorted', icon: <FolderInput size={16} />, run: go('/unsorted') },
      { id: 'tasks', label: 'Go to Tasks', icon: <SquareCheck size={16} />, run: go('/tasks') },
      { id: 'all', label: 'Go to All items', icon: <Layers size={16} />, run: go('/all') },
      { id: 'fav', label: 'Go to Favorites', icon: <Star size={16} />, run: go('/favorites') },
      { id: 'tags', label: 'Go to Tags', icon: <Hash size={16} />, run: go('/tags') },
      { id: 'search', label: 'Search', hint: '/', icon: <Search size={16} />, run: go('/search') },
      { id: 'focus', label: 'Start a 25-minute focus timer', icon: <Timer size={16} />, run: () => void startFocus(null, 25) },
      { id: 'stats', label: 'Go to Stats', icon: <ChartColumn size={16} />, run: go('/stats') },
      { id: 'archive', label: 'Go to Archive', icon: <Archive size={16} />, run: go('/archive') },
      { id: 'trash', label: 'Go to Trash', icon: <Trash size={16} />, run: go('/trash') },
      { id: 'settings', label: 'Open Settings', icon: <Settings size={16} />, run: go('/settings') },
      {
        id: 'theme',
        label: 'Switch theme (system, light, dark)',
        icon: <Moon size={16} />,
        run: () => (themePref.value = themePref.value === 'system' ? 'light' : themePref.value === 'light' ? 'dark' : 'system'),
      },
      ...VIEW_NAMES.map((v) => ({ id: `view-${v}`, label: `Go to ${VIEW_TITLES[v]}`, icon: <Layers size={16} />, run: go(`/view/${v}`) })),
      ...spaces.map((s) => ({ id: `space-${s.id}`, label: `Go to ${s.name}`, icon: <span>{s.emoji}</span>, run: go(`/s/${s.id}`) })),
    ],
    [spaces, path],
  );

  const query = q.trim().toLowerCase();
  const shownCommands = query ? commands.filter((c) => matches(c.label, query)) : commands.slice(0, 8);
  const itemIds = useMemo(() => (query ? search(query, 8) : []), [query, searchIndex.value]);
  const items = useLive(async () => (await db.items.bulkGet(itemIds)).filter((i): i is Item => !!i), [itemIds.join(',')]) ?? [];

  const entries: Command[] = [
    ...shownCommands,
    ...items.map((i) => ({
      id: `item-${i.id}`,
      label: displayTitle(i),
      icon: <CornerDownLeft size={16} />,
      run: () => route(`${path}?item=${i.id}`),
    })),
  ];

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, entries.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && entries[active]) {
      e.preventDefault();
      close();
      entries[active].run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  return (
    <div class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="absolute inset-0 bg-black/40" onClick={close} />
      <div class="relative w-full max-w-lg card shadow-2xl overflow-hidden">
        <div class="flex items-center gap-2 px-3 border-b border-border">
          <Search size={18} class="text-subtle" />
          <input
            ref={input}
            class="flex-1 h-12 bg-transparent outline-none"
            placeholder="Type a command or search items…"
            value={q}
            onInput={(e) => setQ(e.currentTarget.value)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={entries[active] ? `palette-${entries[active].id}` : undefined}
          />
          <span class="kbd">Esc</span>
        </div>
        <div ref={list} id="palette-list" role="listbox" class="max-h-[50vh] overflow-y-auto p-1.5">
          {entries.length === 0 && <p class="text-sm text-subtle px-3 py-6 text-center">No matches.</p>}
          {entries.map((c, i) => (
            <button
              key={c.id}
              id={`palette-${c.id}`}
              data-index={i}
              role="option"
              aria-selected={i === active}
              class={`w-full flex items-center gap-3 px-3 h-10 rounded-lg text-sm text-left ${i === active ? 'bg-accent-fill text-accent' : 'text-text'}`}
              onMouseMove={() => setActive(i)}
              onClick={() => {
                close();
                c.run();
              }}
            >
              <span class="w-5 grid place-items-center text-subtle shrink-0">{c.icon}</span>
              <span class="flex-1 truncate">{c.label}</span>
              {c.hint && <span class="kbd">{c.hint}</span>}
              {c.id.startsWith('item-') && i === shownCommands.length && <span class="text-xs text-subtle">Item</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
