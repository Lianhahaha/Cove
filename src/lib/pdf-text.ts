import { liveQuery } from 'dexie';
import { db } from './db';

export const PDF_TEXT_LIMIT = 200_000;
const PAGE_LIMIT = 300;

/**
 * Pulls the text layer out of a PDF. pdf.js (about 1.7 MB) is loaded only
 * here, the first time a PDF needs reading, and cached by the service worker.
 */
export async function extractPdfText(blob: Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  // Only the text layer is read: no rendering, no XFA forms, no scripts from the document.
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), enableXfa: false });
  const doc = await task.promise;
  try {
    let text = '';
    for (let n = 1; n <= Math.min(doc.numPages, PAGE_LIMIT) && text.length < PDF_TEXT_LIMIT; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      text += content.items.map((i) => ('str' in i ? i.str : '')).join(' ') + '\n';
      page.cleanup();
    }
    return text.replace(/[ \t]+/g, ' ').slice(0, PDF_TEXT_LIMIT);
  } finally {
    await task.destroy();
  }
}

let running = false;

/** Reads the text of PDFs attached since the last run, one at a time. */
export async function processPdfQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const next = await db.files.filter((f) => f.textStatus === 'pending').first();
      if (!next) return;
      try {
        const text = await extractPdfText(next.blob);
        await db.files.update(next.id, { text, textStatus: 'done' });
      } catch (e) {
        // Offline before pdf.js was ever downloaded: leave it pending and try when back online.
        if (!navigator.onLine) return;
        console.warn('Could not read PDF text', e);
        await db.files.update(next.id, { textStatus: 'failed' });
      }
    }
  } finally {
    running = false;
  }
}

export function startPdfQueue(): void {
  addEventListener('online', () => void processPdfQueue());
  liveQuery(() => db.files.filter((f) => f.textStatus === 'pending').count()).subscribe({
    next: (n) => n > 0 && void processPdfQueue(),
  });
}
