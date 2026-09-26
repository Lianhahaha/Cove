import { useLocation } from 'preact-iso';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { restoreItems, trashSpace, TRASH_DAYS, updateItem, updateSpace } from '../lib/repo';
import { toast } from '../lib/toast';
import type { Space } from '../lib/types';
import { Modal } from './Modal';

/** Deletes a space and offers Undo. Its items either move to Unsorted or go to the trash with it. */
export async function deleteSpaceWithUndo(space: Space, mode: 'inbox' | 'trash') {
  const itemIds = (await db.items.where('spaceId').equals(space.id).filter((i) => !i.deletedAt).primaryKeys()) as string[];
  await trashSpace(space.id, mode);
  toast(`Deleted ${space.name}`, {
    ms: 10_000,
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

/** Asks before deleting a space, and what should happen to anything in it. */
export function DeleteSpaceDialog({ space, onClose }: { space: Space; onClose: () => void }) {
  const { route } = useLocation();
  const count = useLive(() => db.items.where('spaceId').equals(space.id).filter((i) => !i.deletedAt).count(), [space.id]);

  async function remove(mode: 'inbox' | 'trash') {
    await deleteSpaceWithUndo(space, mode);
    onClose();
    // Replace, so Back doesn't return to a space that's gone.
    route('/', true);
  }

  return (
    <Modal title={`Delete ${space.name}?`} size="sm" onClose={onClose}>
      {count === undefined ? null : count === 0 ? (
        <div class="space-y-4 pt-1">
          <p class="text-sm text-muted">It’s empty, and you can undo this right after.</p>
          <div class="flex justify-end gap-2">
            <button class="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button class="btn btn-danger" onClick={() => void remove('inbox')}>Delete space</button>
          </div>
        </div>
      ) : (
        <div class="space-y-4 pt-1">
          <p class="text-sm text-muted">
            It has {count} item{count === 1 ? '' : 's'}. What should happen to {count === 1 ? 'it' : 'them'}?
          </p>
          <div class="flex flex-col gap-2">
            <button class="btn justify-start h-auto py-2.5 text-left" onClick={() => void remove('inbox')}>
              <span>
                <span class="block">Keep {count === 1 ? 'it' : 'them'} in Unsorted</span>
                <span class="block text-xs text-subtle font-normal">Only the space is deleted.</span>
              </span>
            </button>
            <button class="btn btn-danger justify-start h-auto py-2.5 text-left" onClick={() => void remove('trash')}>
              <span>
                <span class="block">Delete {count === 1 ? 'it' : 'them'} too</span>
                <span class="block text-xs font-normal opacity-80">Kept in Trash for {TRASH_DAYS} days.</span>
              </span>
            </button>
            <button class="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
