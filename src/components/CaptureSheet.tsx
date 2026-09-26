import { useLocation } from 'preact-iso';
import { capture, closeCapture } from '../state';
import { Modal } from './Modal';
import { QuickAdd } from './QuickAdd';
import { toast } from '../lib/toast';

/** The capture dialog opened from the + button, shortcuts and the share target. */
export function CaptureSheet() {
  const { path, route } = useLocation();
  const c = capture.value;
  if (!c.open) return null;
  // Inside a space, new items land in that space unless the text says otherwise.
  const spaceFromRoute = path.startsWith('/s/') ? path.slice(3) : null;
  const defaultSpaceId = c.spaceId !== undefined ? c.spaceId : spaceFromRoute;

  return (
    <Modal title="Capture" onClose={closeCapture}>
      <QuickAdd
        autoFocus
        initialText={c.text ?? ''}
        defaultSpaceId={defaultSpaceId}
        extra={path === '/tasks' ? { status: 'todo' } : undefined}
        onCreated={(items) => {
          closeCapture();
          if (items.length === 1) {
            toast('Saved', { action: { label: 'Add details', run: () => route(`${path}?item=${items[0].id}`) } });
          }
        }}
      />
      <p class="text-xs text-subtle mt-3">
        <span class="kbd">Enter</span> to save, <span class="kbd">Shift</span>+<span class="kbd">Enter</span> for a new line.
      </p>
    </Modal>
  );
}
