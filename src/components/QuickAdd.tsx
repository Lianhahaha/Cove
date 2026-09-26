import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CalendarDays, Flag, Folder, Hash, Link as LinkIcon, X } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { parseQuickAdd, type Parsed, type ParsePart } from '../lib/parse';
import { formatDue } from '../lib/dates';
import { hostOf } from '../lib/queries';
import { createFromParsed } from '../lib/actions';
import { toast } from '../lib/toast';
import type { Item } from '../lib/types';

interface Props {
  /** Space for new items when the text doesn't name one with @. */
  defaultSpaceId?: string | null;
  initialText?: string;
  autoFocus?: boolean;
  /** Extra fields for every created item, e.g. status on the Tasks page. */
  extra?: Partial<Item>;
  placeholder?: string;
  onCreated?: (items: Item[]) => void;
  /** Rendered beside the save button, e.g. the attach button in the capture sheet. */
  footer?: ComponentChildren;
  /** Lets a parent add files: called with the created item before onCreated. */
  beforeDone?: (items: Item[]) => Promise<void>;
  compact?: boolean;
}

const PRIORITY_LABEL = ['', 'Low', 'Medium', 'High'];

function Chip({ icon, label, onRemove }: { icon: ComponentChildren; label: string; onRemove: () => void }) {
  return (
    <span class="chip chip-accent pr-1">
      {icon}
      <span class="truncate max-w-40">{label}</span>
      <button type="button" class="rounded-full hover:bg-accent-hover p-0.5" aria-label={`Don't use ${label}`} onClick={onRemove}>
        <X size={12} />
      </button>
    </span>
  );
}

export function QuickAdd({ defaultSpaceId = null, initialText = '', autoFocus, extra, placeholder, onCreated, footer, beforeDone, compact }: Props) {
  const [text, setText] = useState(initialText);
  const [ignore, setIgnore] = useState<Set<ParsePart>>(new Set());
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const spaces = useLive(() => db.spaces.filter((s) => !s.deletedAt).toArray(), []) ?? [];

  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text, { spaces, ignore }) : null), [text, spaces, ignore]);
  const lines = useMemo(() => text.split('\n').map((l) => l.trim()).filter(Boolean), [text]);
  const spaceName = parsed?.spaceId ? spaces.find((s) => s.id === parsed.spaceId)?.name : null;

  const skip = (part: ParsePart) => setIgnore(new Set([...ignore, part]));
  // Text that is only a date or tags would make an untitled item, so it can't be saved yet.
  const hasContent = (p: Parsed | null) => !!p && (p.title !== '' || p.url !== null);
  const canSave = hasContent(parsed) && !saving;

  // The autofocus attribute is ignored after page load, so focus by hand and put the caret after any prefilled text.
  useEffect(() => {
    const el = ref.current;
    if (!autoFocus || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  function withDefaults(p: Parsed): Parsed {
    return { ...p, spaceId: p.spaceId ?? defaultSpaceId };
  }

  async function save(split: boolean) {
    if (!canSave) return;
    setSaving(true);
    try {
      const sources = split ? lines.map((l) => parseQuickAdd(l, { spaces, ignore })).filter(hasContent) : [parsed!];
      const created: Item[] = [];
      for (const p of sources) {
        // A time or a priority on the Tasks page already implies a task; extra.status covers the rest.
        created.push(await createFromParsed(withDefaults(p), p.isTask ? { ...extra, status: 'todo' } : extra));
      }
      await beforeDone?.(created);
      setText('');
      setIgnore(new Set());
      if (created.length > 1) toast(`Saved ${created.length} items`);
      onCreated?.(created);
      ref.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      void save(false);
    }
  }

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }

  return (
    <div class={compact ? '' : 'space-y-2'}>
      <textarea
        ref={ref}
        rows={1}
        class="input resize-none leading-relaxed"
        placeholder={placeholder ?? 'Paste a link or type a note…  #tag  @space  fri 5pm  !!'}
        value={text}
        autoFocus={autoFocus}
        maxLength={20_000}
        aria-label="Quick add"
        onInput={(e) => {
          setText(e.currentTarget.value);
          autoGrow(e.currentTarget);
        }}
        onKeyDown={onKeyDown}
      />
      {parsed && (
        <div class="flex flex-wrap items-center gap-1.5 mt-2">
          {parsed.url && <span class="chip"><LinkIcon size={12} />{hostOf(parsed.url)}</span>}
          {spaceName && <Chip icon={<Folder size={12} />} label={spaceName} onRemove={() => skip('space')} />}
          {parsed.due !== null && (
            <Chip icon={<CalendarDays size={12} />} label={formatDue(parsed.due, parsed.dueHasTime)} onRemove={() => skip('due')} />
          )}
          {parsed.priority > 0 && <Chip icon={<Flag size={12} />} label={PRIORITY_LABEL[parsed.priority]} onRemove={() => skip('priority')} />}
          {parsed.tags.length > 0 && <Chip icon={<Hash size={12} />} label={parsed.tags.join(' ')} onRemove={() => skip('tags')} />}
          {parsed.isTask && <span class="chip">Task</span>}
        </div>
      )}
      {(parsed || footer) && (
        <div class="flex items-center gap-2 mt-2">
          {footer}
          <div class="flex-1" />
          {lines.length > 1 && (
            <button type="button" class="btn" disabled={!canSave} onClick={() => save(true)}>
              Split into {lines.length}
            </button>
          )}
          <button type="button" class="btn btn-primary" disabled={!canSave} onClick={() => save(false)}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}
