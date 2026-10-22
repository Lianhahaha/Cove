import { useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Copy, Plus, Trash2, ArrowUpRight } from 'lucide-preact';
import { Modal } from './Modal';
import { scratchpadOpen, scratchpadText, setScratchpadText, closeScratchpad } from '../lib/scratchpad';
import { openCapture } from '../state';
import { toast } from '../lib/toast';
import { createNote } from '../lib/notes';
import { itemUrl } from '../lib/nav';

export function ScratchpadModal() {
  if (!scratchpadOpen.value) return null;
  return <ScratchpadBody />;
}

function ScratchpadBody() {
  const text = scratchpadText.value;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { path, query, route } = useLocation();

  useEffect(() => {
    textarea.current?.focus();
    if (textarea.current) {
      textarea.current.selectionStart = textarea.current.value.length;
      textarea.current.selectionEnd = textarea.current.value.length;
    }
  }, []);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  const handleCopy = () => {
    if (!text.trim()) return;
    navigator.clipboard.writeText(text);
    toast('Copied scratchpad to clipboard');
  };

  const handleClear = () => {
    if (!text.trim()) return;
    setScratchpadText('');
    toast('Scratchpad cleared');
  };

  const handleConvertToItem = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    closeScratchpad();
    openCapture({ text: trimmed });
  };

  const handleConvertToNote = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    closeScratchpad();
    const spaceId = path.startsWith('/s/') ? path.slice(3) : null;
    const note = await createNote(spaceId);
    // Write the scratchpad content into the created note's note field
    const { updateItem } = await import('../lib/repo');
    const firstLine = trimmed.split('\n')[0].replace(/^[#*-\s]+/, '').slice(0, 80);
    await updateItem(note.id, {
      title: firstLine || 'Quick note',
      body: trimmed,
    });
    setScratchpadText('');
    route(itemUrl(path, query, note.id));
    toast('Turned scratchpad into note');
  };

  return (
    <Modal title="Quick Scratchpad" onClose={closeScratchpad} size="lg">
      <div class="flex flex-col gap-3">
        <p class="text-xs text-muted">
          A persistent fleeting notepad for quick jotting, thoughts, drafts, and temporary lists. Auto-saves locally in your browser.
        </p>

        <textarea
          ref={textarea}
          class="w-full h-64 p-3 rounded-xl bg-surface2 border border-border text-sm font-sans focus:outline-none focus:ring-2 focus:ring-accent leading-relaxed resize-y"
          placeholder="Jot down quick thoughts, temporary links, or draft ideas here..."
          value={text}
          onInput={(e) => setScratchpadText(e.currentTarget.value)}
        />

        <div class="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60 text-xs">
          <div class="text-subtle font-mono text-center sm:text-left">
            {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} chars
          </div>

          <div class="grid grid-cols-2 sm:flex sm:items-center gap-1.5">
            <button
              type="button"
              class="btn btn-ghost text-xs h-9 sm:h-8 px-2.5 justify-center"
              onClick={handleCopy}
              disabled={!text.trim()}
              title="Copy to clipboard"
            >
              <Copy size={14} /> Copy
            </button>
            <button
              type="button"
              class="btn btn-ghost text-xs h-9 sm:h-8 px-2.5 text-danger justify-center"
              onClick={handleClear}
              disabled={!text.trim()}
              title="Clear scratchpad"
            >
              <Trash2 size={14} /> Clear
            </button>
            <button
              type="button"
              class="btn btn-secondary text-xs h-9 sm:h-8 px-2.5 justify-center"
              onClick={handleConvertToItem}
              disabled={!text.trim()}
              title="Send to Quick Capture"
            >
              <Plus size={14} /> Task
            </button>
            <button
              type="button"
              class="btn btn-primary text-xs h-9 sm:h-8 px-2.5 justify-center"
              onClick={handleConvertToNote}
              disabled={!text.trim()}
              title="Save as permanent Markdown note"
            >
              <ArrowUpRight size={14} /> Save note
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
