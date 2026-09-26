import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { ArrowDown, ArrowUp } from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { reorderSpaces, restoreItems, SPACE_COLORS, trashSpace, updateItem, updateSpace } from '../lib/repo';
import { toast } from '../lib/toast';
import { toWebUrl } from '../lib/links';
import { FieldLabel } from './InfoTip';
import type { Space } from '../lib/types';
import { Modal } from './Modal';

const EMOJIS = ['📘', '📗', '📕', '📙', '📓', '📐', '🧮', '🧪', '🔬', '🧬', '💻', '🖥️', '🔌', '⚙️', '🤖', '📊', '📈', '🌏', '🏛️', '⚖️', '🎨', '🎵', '🏀', '🗣️', '✍️', '📝', '📚', '🎓', '💼', '🧠', '💡', '🚀', '🏠', '❤️', '⭐', '🗂️'];

export function SpaceSettings({ space, onClose }: { space: Space; onClose: () => void }) {
  const [name, setName] = useState(space.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { route } = useLocation();
  const spaces = useLive(() => db.spaces.orderBy('order').filter((s) => !s.deletedAt).toArray(), []) ?? [];
  const index = spaces.findIndex((s) => s.id === space.id);
  const itemCount = useLive(() => db.items.where('spaceId').equals(space.id).filter((i) => !i.deletedAt).count(), [space.id]) ?? 0;

  const patch = (p: Partial<Space>) => updateSpace(space.id, p);

  const [link, setLink] = useState(space.link ?? '');
  function saveLink() {
    if (!link.trim()) {
      if (space.link) void patch({ link: null });
      return;
    }
    const url = toWebUrl(link);
    if (!url) {
      toast('That doesn’t look like a web address', { tone: 'error' });
      return;
    }
    setLink(url);
    if (url !== space.link) void patch({ link: url });
  }

  function move(delta: number) {
    const ids = spaces.map((s) => s.id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    void reorderSpaces(ids);
  }

  async function remove(mode: 'inbox' | 'trash') {
    const itemIds = (await db.items.where('spaceId').equals(space.id).filter((i) => !i.deletedAt).primaryKeys()) as string[];
    await trashSpace(space.id, mode);
    onClose();
    route('/');
    toast(`Deleted ${space.name}`, {
      action: {
        label: 'Undo',
        run: async () => {
          await updateSpace(space.id, { deletedAt: null });
          if (mode === 'trash') await restoreItems(itemIds);
          else await Promise.all(itemIds.map((id) => updateItem(id, { spaceId: space.id })));
        },
      },
    });
  }

  return (
    <Modal title="Space settings" onClose={onClose}>
      <div class="space-y-5 pt-2">
        <div>
          <label class="label" for="space-name">Name</label>
          <input
            id="space-name"
            class="input"
            value={name}
            maxLength={60}
            onInput={(e) => setName(e.currentTarget.value)}
            onBlur={() => name.trim() && patch({ name })}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && patch({ name })}
          />
        </div>

        <div>
          <FieldLabel text="Class link" htmlFor="space-link" info="This class’s page in Google Classroom or your school’s site. It becomes a one-tap button at the top of the space." />
          <input
            id="space-link"
            class="input"
            // Text, not type="url", so an address without https:// isn't silently refused.
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellcheck={false}
            placeholder="classroom.google.com/c/…"
            value={link}
            onInput={(e) => setLink(e.currentTarget.value)}
            onBlur={saveLink}
            onKeyDown={(e) => e.key === 'Enter' && saveLink()}
          />
          <p class="text-xs text-subtle mt-1.5">
            Paste this class’s Google Classroom link, or any class site. It shows as a button at the top of the space.
          </p>
        </div>

        <div>
          <span class="label">Icon</span>
          <div class="grid grid-cols-9 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                class={`h-9 rounded-lg text-lg hover:bg-surface3 ${space.emoji === e ? 'bg-accent-fill ring-1 ring-accent' : ''}`}
                aria-label={`Use ${e}`}
                aria-pressed={space.emoji === e}
                onClick={() => patch({ emoji: e })}
              >
                {e}
              </button>
            ))}
          </div>
          <label class="flex items-center gap-2 mt-2 text-sm text-subtle">
            Or type any emoji
            <input
              class="input w-16 text-center"
              maxLength={4}
              value={space.emoji}
              aria-label="Custom emoji"
              onChange={(e) => e.currentTarget.value.trim() && patch({ emoji: e.currentTarget.value.trim() })}
            />
          </label>
        </div>

        <div>
          <span class="label">Color</span>
          <div class="flex flex-wrap gap-2">
            {SPACE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                class={`w-8 h-8 rounded-full ${space.color === c ? 'ring-2 ring-offset-2 ring-offset-surface ring-text' : ''}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                aria-pressed={space.color === c}
                onClick={() => patch({ color: c })}
              />
            ))}
          </div>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm">Position in the sidebar</span>
          <div class="flex gap-1">
            <button class="icon-btn" aria-label="Move up" disabled={index <= 0} onClick={() => move(-1)}><ArrowUp size={16} /></button>
            <button class="icon-btn" aria-label="Move down" disabled={index === spaces.length - 1} onClick={() => move(1)}><ArrowDown size={16} /></button>
          </div>
        </div>

        <label class="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" class="w-4 h-4 mt-1 accent-[var(--c-accent)]" checked={space.aiExcluded} onChange={(e) => patch({ aiExcluded: e.currentTarget.checked })} />
          <span>
            <span class="text-sm font-medium block">Keep this space away from AI</span>
            <span class="text-xs text-subtle">Nothing in it is ever sent to the AI features, even when they're on.</span>
          </span>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" class="w-4 h-4 mt-1 accent-[var(--c-accent)]" checked={space.archived} onChange={(e) => patch({ archived: e.currentTarget.checked })} />
          <span>
            <span class="text-sm font-medium block">Archive this space</span>
            <span class="text-xs text-subtle">Hides it from the sidebar and Home. Find it again under Archive.</span>
          </span>
        </label>

        <div class="border-t border-border pt-4">
          {!confirmDelete ? (
            <button class="btn btn-danger" onClick={() => (itemCount ? setConfirmDelete(true) : remove('inbox'))}>
              Delete space
            </button>
          ) : (
            <div class="space-y-2">
              <p class="text-sm">
                {space.name} has {itemCount} item{itemCount === 1 ? '' : 's'}. What should happen to {itemCount === 1 ? 'it' : 'them'}?
              </p>
              <div class="flex flex-wrap gap-2">
                <button class="btn" onClick={() => remove('inbox')}>Move to Inbox</button>
                <button class="btn btn-danger" onClick={() => remove('trash')}>Delete them too</button>
                <button class="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
