import { useState } from 'preact/hooks';
import { Check, CalendarDays, FileText, Flag, Link as LinkIcon, ListChecks, Lock, Paperclip, Pin, Repeat, Star, StickyNote } from 'lucide-preact';
import type { Item, Space } from '../lib/types';
import { displayTitle, hostOf } from '../lib/queries';
import { dueBucket, formatDue } from '../lib/dates';
import { markdownSnippet } from '../lib/markdown';
import { setDone } from '../lib/actions';
import { ITEM_MIME } from '../lib/dnd';

/** Dragging an item carries the whole selection when the item is part of it. */
function dragProps(item: Item, ctx: CardContext) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      const ids = ctx.selected?.has(item.id) ? [...ctx.selected] : [item.id];
      e.dataTransfer?.setData(ITEM_MIME, ids.join(','));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    },
  };
}

export interface CardContext {
  spaces: Map<string, Space>;
  fileCounts: Map<string, number>;
  showSpace: boolean;
  onOpen: (id: string) => void;
  /** Selection mode for bulk actions. */
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const PRIORITY_CLASS = ['', 'text-subtle', 'text-[#b0752a]', 'text-danger'];

export function TaskCheck({ item, size = 20 }: { item: Item; size?: number }) {
  const done = item.status === 'done';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? 'Mark as not done' : 'Mark as done'}
      class={`shrink-0 grid place-items-center rounded-full border-2 transition-colors ${
        done ? 'bg-accent border-accent text-on-accent' : item.priority === 3 ? 'border-danger' : 'border-border2 hover:border-accent'
      }`}
      style={{ width: size, height: size }}
      onClick={(e) => {
        e.stopPropagation();
        void setDone(item, !done);
      }}
    >
      {done && <Check size={size - 8} strokeWidth={3} />}
    </button>
  );
}

/** Favicons that failed this session, so rows fall back to the link icon without retrying. */
const brokenFavicons = new Set<string>();

function KindIcon({ item }: { item: Item }) {
  const [, rerender] = useState(0);
  if (item.kind === 'link') {
    const favicon = item.preview?.favicon;
    if (favicon && !brokenFavicons.has(favicon)) {
      return (
        <img
          src={favicon}
          alt=""
          width={18}
          height={18}
          loading="lazy"
          referrerpolicy="no-referrer"
          class="rounded-sm"
          onError={() => {
            brokenFavicons.add(favicon);
            rerender((n) => n + 1);
          }}
        />
      );
    }
    return <LinkIcon size={17} class="text-subtle" />;
  }
  if (item.kind === 'file') return <FileText size={17} class="text-subtle" />;
  return <StickyNote size={17} class="text-subtle" />;
}

function Meta({ item, ctx }: { item: Item; ctx: CardContext }) {
  const space = item.spaceId ? ctx.spaces.get(item.spaceId) : null;
  const files = ctx.fileCounts.get(item.id) ?? 0;
  const doneCount = item.checklist.filter((c) => c.done).length;
  const bucket = dueBucket(item.due, item.dueHasTime);
  const overdue = bucket === 'overdue' && item.status !== 'done';
  return (
    <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-subtle mt-1">
      {item.due !== null && item.status !== 'none' && (
        <span class={`inline-flex items-center gap-1 ${overdue ? 'text-danger font-medium' : bucket === 'today' ? 'text-accent font-medium' : ''}`}>
          <CalendarDays size={12} />
          {formatDue(item.due, item.dueHasTime)}
          {item.recurrence && <Repeat size={11} />}
        </span>
      )}
      {item.priority > 0 && item.status !== 'none' && (
        <span class={`inline-flex items-center ${PRIORITY_CLASS[item.priority]}`} title={`Priority ${item.priority}`}>
          <Flag size={12} />
        </span>
      )}
      {item.checklist.length > 0 && (
        <span class="inline-flex items-center gap-1">
          <ListChecks size={12} />
          {doneCount}/{item.checklist.length}
        </span>
      )}
      {files > 0 && (
        <span class="inline-flex items-center gap-1">
          <Paperclip size={12} />
          {files}
        </span>
      )}
      {item.url && <span class="truncate max-w-48">{hostOf(item.url)}</span>}
      {ctx.showSpace && space && (
        <span class="inline-flex items-center gap-1 truncate max-w-40">
          <span>{space.emoji}</span>
          {space.name}
        </span>
      )}
      {item.tags.slice(0, 4).map((t) => (
        <span key={t} class="text-accent">#{t}</span>
      ))}
    </div>
  );
}

function Flags({ item }: { item: Item }) {
  return (
    <span class="flex items-center gap-1 text-subtle shrink-0">
      {item.private && <Lock size={14} aria-label="Private" />}
      {item.pinned && <Pin size={14} aria-label="Pinned" />}
      {item.favorite && <Star size={14} class="fill-current text-accent" aria-label="Favorite" />}
    </span>
  );
}

function SelectBox({ item, ctx }: { item: Item; ctx: CardContext }) {
  if (!ctx.selected) return null;
  const on = ctx.selected.has(item.id);
  return (
    <input
      type="checkbox"
      class="w-4 h-4 accent-[var(--c-accent)] shrink-0"
      checked={on}
      aria-label={`Select ${displayTitle(item)}`}
      onClick={(e) => e.stopPropagation()}
      onChange={() => ctx.onToggleSelect?.(item.id)}
    />
  );
}

export function ItemRow({ item, ctx }: { item: Item; ctx: CardContext }) {
  const title = displayTitle(item);
  const snippet = item.private ? '' : markdownSnippet(item.body) || item.preview?.description || '';
  const done = item.status === 'done';
  return (
    <div
      role="button"
      tabIndex={0}
      {...dragProps(item, ctx)}
      onClick={() => (ctx.selected ? ctx.onToggleSelect?.(item.id) : ctx.onOpen(item.id))}
      onKeyDown={(e) => e.key === 'Enter' && ctx.onOpen(item.id)}
      class={`group flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-surface3/60 focus-visible:bg-surface3/60 ${
        ctx.selected?.has(item.id) ? 'bg-accent-fill' : ''
      }`}
    >
      <div class="pt-0.5 flex items-center gap-2">
        <SelectBox item={item} ctx={ctx} />
        {item.status !== 'none' ? <TaskCheck item={item} /> : <span class="w-5 h-5 grid place-items-center"><KindIcon item={item} /></span>}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-2">
          <p class={`flex-1 min-w-0 font-medium leading-snug break-words ${done ? 'line-through text-subtle' : ''} ${item.private ? 'blur-[3px] group-hover:blur-none' : ''}`}>
            {title}
          </p>
          <Flags item={item} />
        </div>
        {snippet && <p class="text-sm text-muted line-clamp-1 mt-0.5">{snippet}</p>}
        <Meta item={item} ctx={ctx} />
      </div>
    </div>
  );
}

export function ItemTile({ item, ctx }: { item: Item; ctx: CardContext }) {
  const title = displayTitle(item);
  const image = !item.private && item.preview?.image;
  const snippet = item.private ? '' : markdownSnippet(item.body) || item.preview?.description || '';
  return (
    <div
      role="button"
      tabIndex={0}
      {...dragProps(item, ctx)}
      onClick={() => (ctx.selected ? ctx.onToggleSelect?.(item.id) : ctx.onOpen(item.id))}
      onKeyDown={(e) => e.key === 'Enter' && ctx.onOpen(item.id)}
      class={`card overflow-hidden flex flex-col hover:border-border2 transition-colors ${ctx.selected?.has(item.id) ? 'ring-2 ring-accent' : ''}`}
    >
      {image ? (
        <div class="aspect-[1.91/1] bg-surface2 overflow-hidden">
          <img
            src={image}
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
            class="w-full h-full object-cover"
            onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')}
          />
        </div>
      ) : null}
      <div class="p-3 flex flex-col gap-1 flex-1">
        <div class="flex items-start gap-2">
          <SelectBox item={item} ctx={ctx} />
          {item.status !== 'none' ? <TaskCheck item={item} size={18} /> : <span class="pt-0.5"><KindIcon item={item} /></span>}
          <p class={`flex-1 min-w-0 font-medium leading-snug line-clamp-2 ${item.status === 'done' ? 'line-through text-subtle' : ''} ${item.private ? 'blur-[3px]' : ''}`}>
            {title}
          </p>
          <Flags item={item} />
        </div>
        {snippet && <p class="text-sm text-muted line-clamp-3">{snippet}</p>}
        <div class="mt-auto">
          <Meta item={item} ctx={ctx} />
        </div>
      </div>
    </div>
  );
}
