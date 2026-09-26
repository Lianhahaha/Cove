import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Copy,
  CopyPlus,
  ExternalLink,
  Lock,
  LockOpen,
  Pin,
  PinOff,
  Star,
  SquareCheck,
  Trash,
  X,
} from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { useItemNav } from '../lib/nav';
import { updateItem } from '../lib/repo';
import { archiveWithUndo, duplicateItem, setDone, trashWithUndo } from '../lib/actions';
import { fromInputs, timeAgo, toDateInput, toTimeInput } from '../lib/dates';
import { displayTitle, hostOf } from '../lib/queries';
import { toast } from '../lib/toast';
import type { Item, Priority, Recurrence, TaskStatus } from '../lib/types';
import { ChecklistEditor, MarkdownField, TagEditor, useDebouncedSave } from './fields';

const STATUS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
];
const PRIORITIES = ['None', 'Low', 'Medium', 'High'];

export function ItemDetail() {
  const { openId, close } = useItemNav();
  const item = useLive(() => (openId ? db.items.get(openId) : undefined), [openId]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]:not([data-detail])')) close();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [openId]);

  if (!openId) return null;

  return (
    <div class="fixed inset-0 z-30 flex justify-end" role="dialog" aria-modal="true" aria-label="Item details" data-detail>
      <div class="absolute inset-0 bg-black/30 hidden md:block" onClick={close} />
      <div class="relative w-full md:w-[min(600px,100%)] h-full bg-surface md:border-l border-border shadow-2xl overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {item === undefined ? null : !item ? (
          <div class="p-6">
            <p class="text-subtle">This item no longer exists.</p>
            <button class="btn mt-4" onClick={close}>Close</button>
          </div>
        ) : (
          <Editor key={item.id} item={item} onClose={close} />
        )}
      </div>
    </div>
  );
}

function Editor({ item, onClose }: { item: Item; onClose: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [url, setUrl] = useState(item.url ?? '');
  const spaces = useLive(() => db.spaces.orderBy('order').filter((s) => !s.deletedAt).toArray(), []) ?? [];
  const allTags = useLive(async () => (await db.items.orderBy('tags').uniqueKeys()) as string[], []) ?? [];

  useDebouncedSave(title, (v) => updateItem(item.id, { title: v }));
  useDebouncedSave(body, (v) => updateItem(item.id, { body: v }));

  const patch = (p: Partial<Item>) => updateItem(item.id, p);
  const isTask = item.status !== 'none';

  function saveUrl() {
    const v = url.trim();
    if (v === (item.url ?? '')) return;
    if (!v) {
      patch({ url: null, preview: null, kind: item.kind === 'link' ? 'note' : item.kind });
      return;
    }
    try {
      const u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
      setUrl(u.href);
      patch({ url: u.href, kind: item.kind === 'file' ? 'file' : 'link', preview: { status: 'pending' } });
    } catch {
      toast('That doesn’t look like a web address', { tone: 'error' });
      setUrl(item.url ?? '');
    }
  }

  const dueDate = item.due !== null ? toDateInput(item.due) : '';
  const dueTime = item.due !== null && item.dueHasTime ? toTimeInput(item.due) : '';
  function setDue(date: string, time: string) {
    const due = date ? fromInputs(date, time) : null;
    patch({ due, dueHasTime: !!(date && time) });
  }

  async function copyLink() {
    if (!item.url) return;
    try {
      await navigator.clipboard.writeText(item.url);
      toast('Link copied');
    } catch {
      toast('Couldn’t copy the link', { tone: 'error' });
    }
  }

  const iconAction = (label: string, icon: ComponentChildren, run: () => void, active = false) => (
    <button class={`icon-btn ${active ? 'text-accent' : ''}`} title={label} aria-label={label} aria-pressed={active} onClick={run}>
      {icon}
    </button>
  );

  return (
    <div class="flex flex-col min-h-full">
      <div class="sticky top-0 z-10 bg-surface/95 backdrop-blur flex items-center gap-1 px-2 h-14 border-b border-border">
        <button class="icon-btn md:hidden" aria-label="Back" onClick={onClose}><ArrowLeft size={20} /></button>
        <div class="flex-1" />
        {iconAction(item.pinned ? 'Unpin' : 'Pin', item.pinned ? <PinOff size={18} /> : <Pin size={18} />, () => patch({ pinned: !item.pinned }), item.pinned)}
        {iconAction(item.favorite ? 'Remove from favorites' : 'Add to favorites', <Star size={18} class={item.favorite ? 'fill-current' : ''} />, () => patch({ favorite: !item.favorite }), item.favorite)}
        {iconAction(item.private ? 'Make not private' : 'Make private (never sent to AI)', item.private ? <Lock size={18} /> : <LockOpen size={18} />, () => patch({ private: !item.private }), item.private)}
        {iconAction('Duplicate', <CopyPlus size={18} />, async () => {
          await duplicateItem(item);
          toast('Duplicated');
        })}
        {iconAction(item.archived ? 'Unarchive' : 'Archive', item.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />, () => archiveWithUndo([item.id], !item.archived))}
        {iconAction('Delete', <Trash size={18} />, () => {
          void trashWithUndo([item.id]);
          onClose();
        })}
        <button class="icon-btn hidden md:inline-flex" aria-label="Close" onClick={onClose}><X size={20} /></button>
      </div>

      <div class="p-4 md:p-6 space-y-5 flex-1">
        {item.preview?.image && !item.private && (
          <img src={item.preview.image} alt="" referrerpolicy="no-referrer" class="w-full aspect-[1.91/1] object-cover rounded-xl border border-border" onError={(e) => (e.currentTarget.style.display = 'none')} />
        )}

        <textarea
          class="w-full bg-transparent outline-none text-xl font-semibold resize-none leading-snug"
          rows={1}
          placeholder={displayTitle(item) === 'Untitled' ? 'Title' : displayTitle(item)}
          value={title}
          maxLength={300}
          onInput={(e) => {
            setTitle(e.currentTarget.value.replace(/\n/g, ' '));
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
          }}
          ref={(el) => {
            if (el) {
              el.style.height = 'auto';
              el.style.height = el.scrollHeight + 'px';
            }
          }}
          aria-label="Title"
        />

        {(item.kind === 'link' || item.url) && (
          <div>
            <label class="label" for="item-url">Link</label>
            <div class="flex gap-2">
              <input id="item-url" class="input" type="url" inputMode="url" value={url} placeholder="https://" onInput={(e) => setUrl(e.currentTarget.value)} onBlur={saveUrl} onKeyDown={(e) => e.key === 'Enter' && saveUrl()} />
              {item.url && (
                <>
                  <a class="btn shrink-0" href={item.url} target="_blank" rel="noopener noreferrer" title={`Open ${hostOf(item.url)}`}>
                    <ExternalLink size={16} />
                    <span class="hidden sm:inline">Open</span>
                  </a>
                  <button class="btn shrink-0" onClick={copyLink} aria-label="Copy link"><Copy size={16} /></button>
                </>
              )}
            </div>
            {item.preview?.status === 'ok' && item.preview.description && !item.private && (
              <p class="text-sm text-muted mt-2 line-clamp-3">{item.preview.description}</p>
            )}
            {item.preview?.status === 'pending' && <p class="text-xs text-subtle mt-1.5">Preview will load when you’re online.</p>}
          </div>
        )}

        <MarkdownField value={body} onChange={setBody} />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="label" for="item-space">Space</label>
            <select id="item-space" class="input" value={item.spaceId ?? ''} onChange={(e) => patch({ spaceId: e.currentTarget.value || null })}>
              <option value="">Inbox</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <span class="label">Tags</span>
            <TagEditor tags={item.tags} onChange={(tags) => patch({ tags })} suggestions={allTags} />
          </div>
        </div>

        <section class="card p-4 space-y-4 bg-surface2">
          {!isTask ? (
            <button class="btn btn-soft w-full" onClick={() => patch({ status: 'todo' })}>
              <SquareCheck size={16} /> Make it a task
            </button>
          ) : (
            <>
              <div class="flex items-center justify-between gap-2">
                <div class="flex gap-1 p-1 rounded-lg bg-surface3" role="radiogroup" aria-label="Status">
                  {STATUS.map((s) => (
                    <button
                      key={s.value}
                      role="radio"
                      aria-checked={item.status === s.value}
                      class={`px-3 h-8 rounded-md text-sm ${item.status === s.value ? 'bg-surface shadow-sm font-medium' : 'text-muted'}`}
                      onClick={() => (s.value === 'done' ? setDone(item, true) : patch({ status: s.value, completedAt: null }))}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button class="text-xs text-subtle hover:text-text" onClick={() => patch({ status: 'none', due: null, dueHasTime: false, recurrence: null, remindAt: null, completedAt: null })}>
                  Not a task
                </button>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label class="label" for="due-date">Due</label>
                  <input id="due-date" type="date" class="input" value={dueDate} onChange={(e) => setDue(e.currentTarget.value, dueTime)} />
                </div>
                <div>
                  <label class="label" for="due-time">Time</label>
                  <input id="due-time" type="time" class="input" value={dueTime} disabled={!dueDate} onChange={(e) => setDue(dueDate, e.currentTarget.value)} />
                </div>
                <div class="col-span-2 sm:col-span-1">
                  <label class="label" for="priority">Priority</label>
                  <select id="priority" class="input" value={item.priority} onChange={(e) => patch({ priority: Number(e.currentTarget.value) as Priority })}>
                    {PRIORITIES.map((p, i) => (
                      <option key={p} value={i}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <RecurrenceField value={item.recurrence} disabled={item.due === null} onChange={(recurrence) => patch({ recurrence })} />

              <div>
                <span class="label">Checklist</span>
                <ChecklistEditor items={item.checklist} onChange={(checklist) => patch({ checklist })} />
              </div>
            </>
          )}
        </section>

        <p class="text-xs text-subtle">
          Added {timeAgo(item.createdAt)} · Edited {timeAgo(item.updatedAt)}
          {item.completedAt ? ` · Done ${timeAgo(item.completedAt)}` : ''}
        </p>
      </div>
    </div>
  );
}

function RecurrenceField({ value, disabled, onChange }: { value: Recurrence | null; disabled: boolean; onChange: (r: Recurrence | null) => void }) {
  return (
    <div>
      <label class="label" for="repeat">Repeat</label>
      <div class="flex gap-2">
        <select
          id="repeat"
          class="input"
          disabled={disabled}
          value={value?.freq ?? ''}
          onChange={(e) => {
            const freq = e.currentTarget.value as Recurrence['freq'] | '';
            onChange(freq ? { freq, interval: value?.interval ?? 1 } : null);
          }}
        >
          <option value="">Doesn’t repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        {value && (
          <label class="flex items-center gap-2 text-sm text-muted shrink-0">
            every
            <input
              type="number"
              min={1}
              max={99}
              class="input w-16"
              value={value.interval}
              onChange={(e) => onChange({ ...value, interval: Math.min(99, Math.max(1, Number(e.currentTarget.value) || 1)) })}
              aria-label="Repeat interval"
            />
          </label>
        )}
      </div>
      {disabled && <p class="text-xs text-subtle mt-1">Set a due date to repeat.</p>}
    </div>
  );
}
