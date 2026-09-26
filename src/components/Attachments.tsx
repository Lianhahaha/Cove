import { useEffect, useRef, useState } from 'preact/hooks';
import { Download, File as FileIcon, FileText, Image as ImageIcon, Paperclip, Trash } from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { addFiles, formatBytes } from '../lib/files';
import { deleteFile } from '../lib/repo';
import { toast } from '../lib/toast';
import type { StoredFile } from '../lib/types';

/** An object URL for a blob that is revoked when the component goes away. */
function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function FileRow({ file }: { file: StoredFile }) {
  const isImage = file.type.startsWith('image/');
  const url = useObjectUrl(file.blob);
  const Icon = isImage ? ImageIcon : file.type === 'application/pdf' || file.type.startsWith('text/') ? FileText : FileIcon;
  // PDFs, images and text open in a tab; anything else downloads, since the browser can't show it.
  const viewable = isImage || file.type === 'application/pdf' || file.type.startsWith('text/') || file.type.startsWith('video/') || file.type.startsWith('audio/');

  async function remove() {
    await deleteFile(file.id);
    toast(`Removed ${file.name}`, { action: { label: 'Undo', run: () => void db.files.add(file) } });
  }

  return (
    <div class="card overflow-hidden">
      {isImage && url && (
        <a href={url} target="_blank" rel="noopener" class="block bg-surface2">
          <img src={url} alt={file.name} class="w-full max-h-72 object-contain" />
        </a>
      )}
      <div class="flex items-center gap-3 p-2.5">
        <Icon size={18} class="text-subtle shrink-0" />
        <div class="min-w-0 flex-1">
          {url && viewable ? (
            <a href={url} target="_blank" rel="noopener" class="block text-sm font-medium truncate hover:underline">{file.name}</a>
          ) : (
            <p class="text-sm font-medium truncate">{file.name}</p>
          )}
          <p class="text-xs text-subtle">{formatBytes(file.size)}</p>
        </div>
        {url && (
          <a class="icon-btn" href={url} download={file.name} aria-label={`Download ${file.name}`} title="Download">
            <Download size={16} />
          </a>
        )}
        <button class="icon-btn" aria-label={`Remove ${file.name}`} title="Remove" onClick={remove}>
          <Trash size={16} />
        </button>
      </div>
    </div>
  );
}

export function Attachments({ itemId }: { itemId: string }) {
  const files = useLive(() => db.files.where('itemId').equals(itemId).sortBy('createdAt'), [itemId]);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <section
      class={`rounded-xl ${over ? 'ring-2 ring-accent' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer?.types.includes('Files')) {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer?.files.length) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        void addFiles(itemId, [...e.dataTransfer.files]);
      }}
    >
      <div class="flex items-center justify-between mb-1.5">
        <span class="label mb-0">Files</span>
        <button class="btn btn-ghost min-h-8 text-sm" onClick={() => input.current?.click()}>
          <Paperclip size={15} /> Attach
        </button>
        <input
          ref={input}
          type="file"
          multiple
          class="hidden"
          onChange={(e) => {
            const list = e.currentTarget.files;
            if (list?.length) void addFiles(itemId, [...list]);
            e.currentTarget.value = '';
          }}
        />
      </div>
      {files && files.length > 0 ? (
        <div class="space-y-2">
          {files.map((f) => <FileRow key={f.id} file={f} />)}
        </div>
      ) : (
        <p class="text-sm text-subtle">Drop files here, paste an image, or attach PDFs, slides and photos. They're stored on this device.</p>
      )}
    </section>
  );
}
