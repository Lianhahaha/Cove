import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Download, File as FileIcon, FileText, Image as ImageIcon, Paperclip, Trash } from 'lucide-preact';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { addFiles, formatBytes } from '../lib/files';
import { deleteFile } from '../lib/repo';
import { toast } from '../lib/toast';
import type { StoredFile } from '../lib/types';
import { InfoTip } from './InfoTip';

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

/**
 * Types that are safe to open in a tab. A blob URL runs with Cove's origin,
 * so anything that can carry script (HTML, SVG, XML) must never open as a page.
 */
export function isViewable(type: string): boolean {
  const t = type.toLowerCase().split(';')[0].trim();
  return (
    /^image\/(png|jpe?g|gif|webp|avif|bmp)$/.test(t) ||
    t === 'application/pdf' ||
    t === 'text/plain' ||
    /^(audio|video)\//.test(t)
  );
}

function FileRow({ file }: { file: StoredFile }) {
  const viewable = isViewable(file.type);
  const isImage = file.type.startsWith('image/');
  // Everything that isn't known-safe is handed over as an opaque download.
  const blob = useMemo(() => (viewable ? file.blob : new Blob([file.blob], { type: 'application/octet-stream' })), [file.blob, viewable]);
  const url = useObjectUrl(blob);
  const Icon = isImage ? ImageIcon : file.type === 'application/pdf' || file.type.startsWith('text/') ? FileText : FileIcon;

  async function remove() {
    await deleteFile(file.id);
    toast(`Removed ${file.name}`, { action: { label: 'Undo', run: () => void db.files.add(file) } });
  }

  return (
    <div class="card overflow-hidden">
      {isImage && viewable && url && (
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
        <span class="flex items-center gap-1">
          <span class="label mb-0">Files</span>
          <InfoTip label="Files">PDFs, slides and photos saved on this device, so they open offline. Up to 25 MB each. Text inside PDFs shows up in search.</InfoTip>
        </span>
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
