import { addFile, FileTooLargeError, LIMITS } from './repo';
import { toast, toastError } from './toast';

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

let persistAsked = false;

/**
 * Asks the browser once to keep Cove's data even under storage pressure.
 * Installed PWAs usually get this automatically; tabs may be refused.
 */
export async function requestPersistence(): Promise<boolean> {
  if (persistAsked || !navigator.storage?.persist) return false;
  persistAsked = true;
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

/** Screenshots pasted from the clipboard arrive as "image.png"; give them a dated name. */
export function nameForPasted(file: File): string {
  if (file.name && file.name !== 'image.png') return file.name;
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  return `Screenshot ${stamp}.${ext}`;
}

/** Stores files on an item, skipping any over the size limit or the device's free space. */
export async function addFiles(itemId: string, files: File[]): Promise<number> {
  let added = 0;
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  let free = estimate?.quota !== undefined && estimate.usage !== undefined ? estimate.quota - estimate.usage : Infinity;
  for (const f of files) {
    if (f.size > free) {
      toastError(`Not enough space on this device for ${f.name}`);
      continue;
    }
    try {
      await addFile(itemId, f, nameForPasted(f));
      free -= f.size;
      added++;
    } catch (e) {
      if (e instanceof FileTooLargeError) toastError(`${f.name} is over ${LIMITS.fileBytes / 1024 / 1024} MB`);
      else toastError(`Couldn't save ${f.name}`);
    }
  }
  if (added) {
    void requestPersistence();
    if (files.length > 1) toast(`Attached ${added} file${added === 1 ? '' : 's'}`);
  }
  return added;
}

/** Files from a paste event, if any. */
export function filesFromClipboard(e: ClipboardEvent): File[] {
  return [...(e.clipboardData?.files ?? [])];
}
