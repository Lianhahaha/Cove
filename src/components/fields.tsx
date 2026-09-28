import { useEffect, useRef, useState } from 'preact/hooks';
import { GripVertical, Plus, X } from 'lucide-preact';
import { normalizeTag, uid } from '../lib/repo';
import { renderMarkdown } from '../lib/markdown';
import type { ChecklistEntry } from '../lib/types';

/** Calls `save` once typing pauses, and flushes on unmount so nothing is lost. */
export function useDebouncedSave<T>(value: T, save: (v: T) => void, ms = 400) {
  // The last value written, starting with the one loaded.
  const saved = useRef(value);
  const latest = useRef({ value, save });
  latest.current = { value, save };
  useEffect(() => {
    if (value === saved.current) return;
    const t = setTimeout(() => {
      saved.current = value;
      save(value);
    }, ms);
    return () => clearTimeout(t);
  }, [value]);
  // Compares against what was saved rather than waiting for the effect above:
  // effects run after paint, so text typed in the frame before closing would be missed.
  useEffect(
    () => () => {
      const { value, save } = latest.current;
      if (value !== saved.current) {
        saved.current = value;
        save(value);
      }
    },
    [],
  );
}

/**
 * Runs `save` when the component goes away. For fields that save on blur:
 * closing a panel with Escape or Back removes the field, and browsers don't
 * reliably send a blur for that, so the last edit would be lost.
 */
export function useSaveOnClose(save: () => void) {
  const latest = useRef(save);
  latest.current = save;
  useEffect(() => () => latest.current(), []);
}

export function TagEditor({ tags, onChange, suggestions }: { tags: string[]; onChange: (t: string[]) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState('');
  function commit(raw = draft) {
    const t = normalizeTag(raw);
    setDraft('');
    if (t && !tags.includes(t)) onChange([...tags, t]);
  }
  useSaveOnClose(() => draft && commit());
  return (
    <div class="input flex flex-wrap items-center gap-1.5 py-1.5 min-h-10 cursor-text" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}>
      {tags.map((t) => (
        <span key={t} class="chip chip-accent pr-1">
          #{t}
          <button type="button" class="rounded-full hover:bg-accent-hover p-0.5" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        class="flex-1 min-w-24 bg-transparent outline-none text-sm"
        placeholder={tags.length ? '' : 'Add tags'}
        value={draft}
        list="cove-tag-suggestions"
        aria-label="Add tag"
        onInput={(e) => {
          const v = e.currentTarget.value;
          if (/[,\s]$/.test(v)) commit(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => commit()}
      />
      <datalist id="cove-tag-suggestions">
        {suggestions.filter((s) => !tags.includes(s)).slice(0, 50).map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}

export function ChecklistEditor({ items, onChange }: { items: ChecklistEntry[]; onChange: (c: ChecklistEntry[]) => void }) {
  const [draft, setDraft] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const update = (id: string, patch: Partial<ChecklistEntry>) => onChange(items.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  function add() {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { id: uid(), text: text.slice(0, 300), done: false }]);
    setDraft('');
  }
  useSaveOnClose(add);

  function move(from: number, to: number) {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div class="space-y-1">
      {items.map((c, i) => (
        <div
          key={c.id}
          class={`flex items-center gap-2 group rounded-lg ${drag === i ? 'opacity-50' : ''}`}
          draggable
          onDragStart={() => setDrag(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (drag !== null) move(drag, i);
            setDrag(null);
          }}
          onDragEnd={() => setDrag(null)}
        >
          <GripVertical size={14} class="text-subtle opacity-0 group-hover:opacity-100 cursor-grab shrink-0 hidden sm:block" />
          <input type="checkbox" class="w-4 h-4 accent-[var(--c-accent)] shrink-0" checked={c.done} aria-label={c.text} onChange={(e) => update(c.id, { done: e.currentTarget.checked })} />
          <input
            class={`flex-1 bg-transparent outline-none text-sm py-1 ${c.done ? 'line-through text-subtle' : ''}`}
            value={c.text}
            maxLength={300}
            onChange={(e) => update(c.id, { text: e.currentTarget.value })}
            aria-label="Checklist entry"
          />
          <button type="button" class="icon-btn w-7 h-7 opacity-60 hover:opacity-100" aria-label={`Remove ${c.text}`} onClick={() => onChange(items.filter((x) => x.id !== c.id))}>
            <X size={14} />
          </button>
        </div>
      ))}
      <div class="flex items-center gap-2">
        <Plus size={16} class="text-subtle shrink-0 sm:ml-5" />
        <input
          class="flex-1 bg-transparent outline-none text-sm py-1.5"
          placeholder="Add a step"
          value={draft}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          aria-label="Add checklist entry"
        />
      </div>
    </div>
  );
}

export function MarkdownField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [mode, setMode] = useState<'write' | 'preview'>(value.trim() ? 'preview' : 'write');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 120) + 'px';
  }, [value, mode]);

  return (
    <div>
      <div class="flex items-center gap-1 mb-1.5">
        {(['write', 'preview'] as const).map((m) => (
          <button
            key={m}
            type="button"
            class={`px-2.5 h-7 rounded-md text-xs font-medium ${mode === m ? 'bg-surface3 text-text' : 'text-subtle hover:text-text'}`}
            onClick={() => setMode(m)}
          >
            {m === 'write' ? 'Write' : 'Preview'}
          </button>
        ))}
        <span class="text-xs text-subtle ml-auto">Markdown</span>
      </div>
      {mode === 'write' ? (
        <textarea
          ref={ref}
          class="input resize-none font-[inherit] leading-relaxed"
          placeholder="Add a description, notes, or what this is for…"
          value={value}
          onInput={(e) => onChange(e.currentTarget.value)}
          aria-label="Description"
        />
      ) : value.trim() ? (
        <div
          class="prose-cove min-h-16 cursor-text rounded-lg p-1 -m-1 hover:bg-surface2"
          onDblClick={() => setMode('write')}
          // Sanitized by DOMPurify in renderMarkdown.
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
        />
      ) : (
        <button type="button" class="text-sm text-subtle py-2" onClick={() => setMode('write')}>
          No description. Click to write one.
        </button>
      )}
    </div>
  );
}
