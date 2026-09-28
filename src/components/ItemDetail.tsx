import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarPlus,
  Check,
  Copy,
  CopyPlus,
  ExternalLink,
  Link as LinkIcon,
  Lock,
  LockOpen,
  Pin,
  PinOff,
  RefreshCw,
  Sparkles,
  Star,
  SquareCheck,
  Trash,
} from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { useItemNav } from '../lib/nav';
import { TRASH_DAYS, updateItem } from '../lib/repo';
import { archiveWithUndo, duplicateItem, setDone, trashWithUndo } from '../lib/actions';
import { fromInputs, timeAgo, toDateInput, toTimeInput } from '../lib/dates';
import { displayTitle, hostOf } from '../lib/queries';
import { toast } from '../lib/toast';
import type { Item, Priority, Recurrence, TaskStatus } from '../lib/types';
import { ChecklistEditor, MarkdownField, TagEditor, useDebouncedSave } from './fields';
import { Attachments } from './Attachments';
import { refreshPreview } from '../lib/previews';
import { downloadIcs } from '../lib/ics';
import { REMINDER_PRESETS, remindersEnabled } from '../lib/reminders';
import { AI_TASK_LABELS, aiBlockedReason, aiEnabled, type AiTask } from '../lib/ai';
import { AiPanel } from './AiPanel';
import { FocusStarter } from './FocusTimer';
import { addFiles, filesFromClipboard } from '../lib/files';
import { appendMarkdown, discardIfBlank } from '../lib/notes';
import { confirmAction } from '../lib/confirm';
import { FieldLabel, InfoTip } from './InfoTip';

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

  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const typed = useRef({ title, body });
  typed.current = { title, body };
  useEffect(() => {
    // A new, empty item opens ready to type its title.
    if (!item.title && !item.body && !item.url) titleRef.current?.focus();
    // Closing a note you never wrote in deletes it. The saves above flush first, so typed text is never lost.
    return () => {
      if (!typed.current.title.trim() && !typed.current.body.trim()) void discardIfBlank(item.id);
    };
  }, []);

  const patch = (p: Partial<Item>) => updateItem(item.id, p);
  const isTask = item.status !== 'none';
  const [linkOpen, setLinkOpen] = useState(false);
  const showLink = item.kind === 'link' || !!item.url || linkOpen;
  const noun = isTask ? 'task' : item.kind === 'link' ? 'link' : item.kind === 'file' ? 'file' : 'note';
  // Nothing to save yet: closing would discard it anyway.
  const blank = item.kind === 'note' && !title.trim() && !body.trim();

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
    // A reminder keeps its distance from the due date when the date moves.
    const remindAt = due !== null && item.remindAt !== null && item.due !== null ? due - (item.due - item.remindAt) : due === null ? null : item.remindAt;
    patch({ due, dueHasTime: !!(date && time), remindAt });
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
    <div
      class="flex flex-col min-h-full"
      onPaste={(e) => {
        // A pasted image or file attaches to the item instead of vanishing.
        const files = filesFromClipboard(e);
        if (files.length) {
          e.preventDefault();
          void addFiles(item.id, files);
        }
      }}
    >
      <div class="sticky top-0 z-10 bg-surface/95 backdrop-blur flex items-center gap-1 px-2 h-12 md:h-14 border-b border-border">
        <button class="icon-btn" aria-label="Back" title="Back" onClick={onClose}><ArrowLeft size={20} /></button>
        <div class="flex-1" />
        <AiMenu item={item} onAppendBody={(md) => setBody((b) => appendMarkdown(b, md))} />
        <FocusStarter itemId={item.id} />
        {iconAction(item.pinned ? 'Unpin' : 'Pin', item.pinned ? <PinOff size={18} /> : <Pin size={18} />, () => patch({ pinned: !item.pinned }), item.pinned)}
        {iconAction(item.favorite ? 'Remove from favorites' : 'Add to favorites', <Star size={18} class={item.favorite ? 'fill-current' : ''} />, () => patch({ favorite: !item.favorite }), item.favorite)}
        {iconAction(item.private ? 'Make not private' : 'Make private (never sent to AI)', item.private ? <Lock size={18} /> : <LockOpen size={18} />, () => patch({ private: !item.private }), item.private)}
        {iconAction('Duplicate', <CopyPlus size={18} />, async () => {
          await duplicateItem(item);
          toast('Duplicated');
        })}
        {iconAction(item.archived ? 'Unarchive' : 'Archive', item.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />, () => archiveWithUndo([item.id], !item.archived))}
        {iconAction('Delete', <Trash size={18} />, async () => {
          const ok = await confirmAction({
            title: `Delete this ${noun}?`,
            body: `“${displayTitle(item)}” moves to Trash, where you can restore it for ${TRASH_DAYS} days.`,
            confirmLabel: 'Delete',
          });
          if (!ok) return;
          void trashWithUndo([item.id]);
          onClose();
        })}
      </div>

      <div class="p-4 md:p-6 space-y-5 flex-1">
        {item.preview?.image && !item.private && (
          <img src={item.preview.image} alt="" referrerpolicy="no-referrer" class="w-full aspect-[1.91/1] object-cover rounded-xl border border-border" onError={(e) => (e.currentTarget.style.display = 'none')} />
        )}

        <textarea
          class="w-full bg-transparent outline-none font-display text-xl font-medium resize-none leading-snug"
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
            titleRef.current = el;
            if (el) {
              el.style.height = 'auto';
              el.style.height = el.scrollHeight + 'px';
            }
          }}
          aria-label="Title"
        />

        {!showLink && (
          <button
            class="btn btn-ghost -ml-2 -my-2 text-sm text-subtle"
            onClick={() => {
              setLinkOpen(true);
              requestAnimationFrame(() => document.getElementById('item-url')?.focus());
            }}
          >
            <LinkIcon size={16} /> Add a link
          </button>
        )}

        {showLink && (
          <div>
            <FieldLabel text="Link" htmlFor="item-url" info="The web address this item saves. When you’re online, Cove fetches its title, picture and icon. Tap Open to visit it." />
            <div class="flex gap-2">
              <input id="item-url" class="input" type="url" inputMode="url" value={url} placeholder="https://" onInput={(e) => setUrl(e.currentTarget.value)} onBlur={saveUrl} onKeyDown={(e) => e.key === 'Enter' && saveUrl()} />
              {item.url && (
                <>
                  <a class="btn shrink-0" href={item.url} target="_blank" rel="noopener noreferrer" title={`Open ${hostOf(item.url)}`}>
                    <ExternalLink size={16} />
                    <span class="hidden sm:inline">Open</span>
                  </a>
                  <button class="btn shrink-0" onClick={copyLink} aria-label="Copy link" title="Copy link"><Copy size={16} /></button>
                  <button class="btn shrink-0" onClick={() => refreshPreview(item.id)} aria-label="Refresh preview" title="Refresh preview"><RefreshCw size={16} /></button>
                </>
              )}
            </div>
            {item.preview?.status === 'ok' && item.preview.description && !item.private && (
              <p class="text-sm text-muted mt-2 line-clamp-3">{item.preview.description}</p>
            )}
            {item.preview?.status === 'pending' && <p class="text-xs text-subtle mt-1.5">Preview will load when you’re online.</p>}
            {item.preview?.status === 'error' && <p class="text-xs text-subtle mt-1.5">No preview: {item.preview.error ?? 'the site couldn’t be read'}.</p>}
          </div>
        )}

        <MarkdownField value={body} onChange={setBody} />

        <Attachments itemId={item.id} />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel text="Space" htmlFor="item-space" info="The subject or project this belongs to. Items with no space wait in Unsorted. When adding, type @ and the space’s name to file it straight away." />
            <select id="item-space" class="input" value={item.spaceId ?? ''} onChange={(e) => patch({ spaceId: e.currentTarget.value || null })}>
              <option value="">No space (Unsorted)</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel text="Tags" info="Labels like lab or exam that work across subjects. Tap a tag anywhere to see everything with it. When adding, type #tag." />
            <TagEditor tags={item.tags} onChange={(tags) => patch({ tags })} suggestions={allTags} />
          </div>
        </div>

        <section class="card p-4 space-y-4 bg-surface2">
          {!isTask ? (
            <div class="flex items-center gap-2">
              <button class="btn btn-soft flex-1" onClick={() => patch({ status: 'todo' })}>
                <SquareCheck size={16} /> Make it a task
              </button>
              <InfoTip label="a task">
                Adds a due date, priority, checklist, reminder and repeats. Tasks show in Tasks, and on Home when they’re due.
              </InfoTip>
            </div>
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
                      onClick={async () => {
                        if (s.value === 'done') return setDone(item, true);
                        if (item.status === 'done') await setDone(item, false);
                        await patch({ status: s.value, completedAt: null });
                      }}
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
                  <FieldLabel text="Due" htmlFor="due-date" info="When it’s due. Overdue tasks and today’s show on Home and in Tasks, and the installed app’s icon counts them." />
                  <input id="due-date" type="date" class="input" value={dueDate} onChange={(e) => setDue(e.currentTarget.value, dueTime)} />
                </div>
                <div>
                  <label class="label" for="due-time">Time</label>
                  <input id="due-time" type="time" class="input" value={dueTime} disabled={!dueDate} onChange={(e) => setDue(dueDate, e.currentTarget.value)} />
                </div>
                <div class="col-span-2 sm:col-span-1">
                  <FieldLabel text="Priority" htmlFor="priority" info="Low, Medium or High. High tasks get a red ring. When adding, type ! for Low, !! for Medium or !!! for High." />
                  <select id="priority" class="input" value={item.priority} onChange={(e) => patch({ priority: Number(e.currentTarget.value) as Priority })}>
                    {PRIORITIES.map((p, i) => (
                      <option key={p} value={i}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div class="grid sm:grid-cols-2 gap-3">
                <RecurrenceField value={item.recurrence} disabled={item.due === null} onChange={(recurrence) => patch({ recurrence })} />
                <ReminderField item={item} onChange={(remindAt) => patch({ remindAt })} />
              </div>
              {item.due !== null && (
                <button class="btn btn-ghost -ml-2 text-sm" onClick={() => downloadIcs([item], displayTitle(item))}>
                  <CalendarPlus size={16} /> Add to my calendar
                </button>
              )}

              <div>
                <FieldLabel text="Checklist" info="Steps inside this task. Its card shows your progress, like 2/5." />
                <ChecklistEditor items={item.checklist} onChange={(checklist) => patch({ checklist })} />
              </div>
            </>
          )}
        </section>

        <p class="text-xs text-subtle">
          Added {timeAgo(item.createdAt)} · Edited {timeAgo(item.updatedAt)}
          {item.completedAt ? ` · Done ${timeAgo(item.completedAt)}` : ''}
          {item.focusMins ? ` · Focused ${item.focusMins} min` : ''}
        </p>
      </div>

      {/* Everything saves as you type; this makes finishing obvious and closes the panel. */}
      <div class="sticky bottom-0 z-10 bg-surface/95 backdrop-blur border-t border-border px-4 md:px-6 py-3 flex items-center gap-3">
        <span class="flex-1 min-w-0 flex items-center gap-1.5 text-xs text-subtle">
          <Check size={14} class="shrink-0" /> Changes save as you type
        </span>
        <button
          class="btn btn-primary"
          disabled={blank}
          title={blank ? 'Write a title or some text first' : undefined}
          onClick={() => {
            onClose();
            toast(`${noun[0].toUpperCase()}${noun.slice(1)} saved`);
          }}
        >
          Save {noun}
        </button>
      </div>
    </div>
  );
}

function RecurrenceField({ value, disabled, onChange }: { value: Recurrence | null; disabled: boolean; onChange: (r: Recurrence | null) => void }) {
  return (
    <div>
      <FieldLabel text="Repeat" htmlFor="repeat" info="When you finish this task, Cove adds the next one, due a day, week or month later. Needs a due date." />
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

function ReminderField({ item, onChange }: { item: Item; onChange: (remindAt: number | null) => void }) {
  const due = item.due;
  // Date-only tasks count from 9am on the day, which is when a reminder "at the due time" makes sense.
  const anchor = due === null ? null : item.dueHasTime ? due : due + 9 * 3_600_000;
  const current =
    item.remindAt === null || anchor === null
      ? 'none'
      : (REMINDER_PRESETS.find((p) => anchor - p.minutesBefore * 60_000 === item.remindAt)?.minutesBefore.toString() ?? 'custom');
  const toLocal = (ts: number) => `${toDateInput(ts)}T${toTimeInput(ts)}`;

  return (
    <div>
      <FieldLabel text="Remind me" htmlFor="remind" info="A notification at the time you pick, while Cove is open. To be alerted when it’s closed, use Add to my calendar." />
      <select
        id="remind"
        class="input"
        disabled={anchor === null}
        value={current}
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v === 'none' || anchor === null) onChange(null);
          else if (v === 'custom') onChange(anchor - 3_600_000);
          else onChange(anchor - Number(v) * 60_000);
        }}
      >
        <option value="none">No reminder</option>
        {REMINDER_PRESETS.map((p) => (
          <option key={p.minutesBefore} value={p.minutesBefore}>{p.label}</option>
        ))}
        <option value="custom">Custom time…</option>
      </select>
      {current === 'custom' && item.remindAt !== null && (
        <input
          type="datetime-local"
          class="input mt-2"
          value={toLocal(item.remindAt)}
          onChange={(e) => {
            const [d, t] = e.currentTarget.value.split('T');
            const ts = fromInputs(d, t ?? '');
            if (ts !== null) onChange(ts);
          }}
          aria-label="Reminder time"
        />
      )}
      {item.remindAt !== null && !remindersEnabled.value && (
        <p class="text-xs text-subtle mt-1">
          Shows inside Cove while it’s open. Turn on notifications in <a class="underline" href="/settings">Settings</a>, or add it to your calendar.
        </p>
      )}
    </div>
  );
}

function AiMenu({ item, onAppendBody }: { item: Item; onAppendBody: (markdown: string) => void }) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<AiTask | null>(null);
  const space = useLive(() => (item.spaceId ? db.spaces.get(item.spaceId) : undefined), [item.spaceId]);
  // Tags already in use, so suggestions reuse them instead of inventing near-duplicates.
  const allTags = useLive(async () => (await db.items.orderBy('tags').uniqueKeys()) as string[], []) ?? [];
  const blocked = aiBlockedReason(item, space);
  // Text read from attached PDFs goes last, so the item's own notes come first within the size cap.
  const pdfText =
    useLive(async () => (await db.files.where('itemId').equals(item.id).toArray()).map((f) => f.text ?? '').filter(Boolean).join('\n\n'), [item.id]) ?? '';
  const text = [item.body, item.preview?.description, item.checklist.map((c) => `- ${c.text}`).join('\n'), pdfText].filter(Boolean).join('\n\n');
  const needs: Record<AiTask, number> = { summarize: 1, tags: 0, extract_tasks: 1, quiz: 80 };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Close on the next click anywhere; the menu's own buttons run first.
    const t = setTimeout(() => addEventListener('click', close, { once: true }));
    return () => {
      clearTimeout(t);
      removeEventListener('click', close);
    };
  }, [open]);

  return (
    <div class="relative">
      <button class={`icon-btn ${open ? 'bg-surface3' : ''}`} title="AI" aria-label="AI actions" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <Sparkles size={18} />
      </button>
      {open && (
        <div class="absolute right-0 top-11 z-20 w-64 card shadow-xl p-1.5" role="menu">
          {!aiEnabled.value ? (
            <p class="text-sm text-muted p-2">
              AI is off. Turn it on in{' '}
              <a class="underline text-accent" href="/settings">Settings</a>.
            </p>
          ) : blocked ? (
            <p class="text-sm text-muted p-2">{blocked}</p>
          ) : (
            (Object.keys(AI_TASK_LABELS) as AiTask[]).map((t) => {
              const tooShort = text.length < needs[t];
              return (
                <button
                  key={t}
                  role="menuitem"
                  disabled={tooShort}
                  title={tooShort ? 'Add more to the description first' : undefined}
                  class="w-full text-left px-3 h-9 rounded-lg text-sm hover:bg-surface3 disabled:opacity-40"
                  onClick={() => {
                    setOpen(false);
                    setTask(t);
                  }}
                >
                  {AI_TASK_LABELS[t]}
                </button>
              );
            })
          )}
        </div>
      )}
      {task && (
        <AiPanel task={task} item={item} onAppendBody={onAppendBody} payload={{ title: displayTitle(item), text, existingTags: allTags }} onClose={() => setTask(null)} />
      )}
    </div>
  );
}
