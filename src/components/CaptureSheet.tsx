import { useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Paperclip, Sparkles, X } from 'lucide-preact';
import { capture, closeCapture } from '../state';
import { addFiles, filesFromClipboard, formatBytes, nameForPasted } from '../lib/files';
import { toast } from '../lib/toast';
import { Modal } from './Modal';
import { QuickAdd } from './QuickAdd';
import { useLazyComponent } from './lazy';
import { aiEnabled } from '../lib/ai';

/** The capture dialog opened from the + button, shortcuts, drops, pastes and the share target. */
export function CaptureSheet() {
  const c = capture.value;
  if (!c.open) return null;
  // Remount per opening so the text box starts from the new prefill.
  return <CaptureBody key={String(c.text) + (c.files?.length ?? 0)} />;
}

function CaptureBody() {
  const { path, route } = useLocation();
  const c = capture.value;
  const [files, setFiles] = useState<File[]>(c.files ?? []);
  const [text, setText] = useState(c.text ?? '');
  const [findTasks, setFindTasks] = useState(false);
  const AiPanel = useLazyComponent(findTasks, () => import('./AiPanel').then((m) => m.AiPanel));
  const input = useRef<HTMLInputElement>(null);
  // Inside a space, new items land in that space unless the text says otherwise.
  const spaceFromRoute = path.startsWith('/s/') ? path.slice(3) : null;
  const defaultSpaceId = c.spaceId !== undefined ? c.spaceId : spaceFromRoute;

  return (
    <Modal title="Capture" onClose={closeCapture}>
      <div
        onPaste={(e) => {
          const pasted = filesFromClipboard(e);
          if (pasted.length) {
            e.preventDefault();
            setFiles([...files, ...pasted]);
          }
        }}
      >
        <QuickAdd
          autoFocus
          initialText={c.text ?? ''}
          defaultSpaceId={defaultSpaceId}
          extra={path === '/tasks' ? { status: 'todo' } : undefined}
          attachments={files}
          onTextChange={setText}
          beforeDone={async (items) => {
            if (files.length) await addFiles(items[0].id, files);
          }}
          onCreated={(items) => {
            closeCapture();
            if (items.length === 1) {
              toast('Saved', { action: { label: 'Add details', run: () => route(`${path}?item=${items[0].id}`) } });
            }
          }}
          footer={
            <>
              <button type="button" class="btn btn-ghost" onClick={() => input.current?.click()}>
                <Paperclip size={16} /> Attach
              </button>
              {aiEnabled.value && text.trim().length >= 30 && (
                <button type="button" class="btn btn-ghost" onClick={() => setFindTasks(true)} title="Find tasks and deadlines in this text with AI">
                  <Sparkles size={16} /> <span class="hidden sm:inline">Find tasks</span>
                </button>
              )}
              <input
                ref={input}
                type="file"
                multiple
                class="hidden"
                onChange={(e) => {
                  const list = e.currentTarget.files;
                  if (list?.length) setFiles([...files, ...list]);
                  e.currentTarget.value = '';
                }}
              />
            </>
          }
        />
        {files.length > 0 && (
          <ul class="mt-3 space-y-1">
            {files.map((f, i) => (
              <li key={i} class="flex items-center gap-2 text-sm bg-surface2 rounded-lg pl-3 pr-1 py-1">
                <Paperclip size={14} class="text-subtle shrink-0" />
                <span class="flex-1 truncate">{nameForPasted(f)}</span>
                <span class="text-xs text-subtle">{formatBytes(f.size)}</span>
                <button class="icon-btn w-7 h-7" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {findTasks && AiPanel && (
        <AiPanel
          task="extract_tasks"
          payload={{ title: '', text }}
          spaceId={defaultSpaceId}
          onClose={() => setFindTasks(false)}
          onTasksCreated={() => closeCapture()}
        />
      )}
      <p class="text-xs text-subtle mt-3 hidden sm:block">
        <span class="kbd">Enter</span> to save, <span class="kbd">Shift</span>+<span class="kbd">Enter</span> for a new line. Paste an image to attach it.
      </p>
    </Modal>
  );
}
