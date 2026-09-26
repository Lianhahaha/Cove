import { NotebookPen } from 'lucide-preact';
import { useItemNav } from '../lib/nav';
import { createNote } from '../lib/notes';

/** Starts a blank note and opens it in the editor. `bar` looks like the quick-add box; `icon` fits a page header. */
export function NewNoteButton({ spaceId = null, variant = 'bar' }: { spaceId?: string | null; variant?: 'bar' | 'icon' }) {
  const { open } = useItemNav();
  const start = async () => open((await createNote(spaceId)).id);
  if (variant === 'icon') {
    return (
      <button class="icon-btn" title="New note" aria-label="New note" onClick={start}>
        <NotebookPen size={18} />
      </button>
    );
  }
  return (
    <button type="button" class="composer w-full text-left hover:border-border2" onClick={start}>
      <NotebookPen size={18} class="composer-icon" aria-hidden="true" />
      <span class="composer-input text-subtle">Write a new note…</span>
    </button>
  );
}
