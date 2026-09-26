import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { addFile, addItem, addSpace, updateItem } from './repo';
import { exportBackup, importBackup, importBookmarks, itemToMarkdown, parseBookmarksHtml, toItem } from './backup';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('backup round trip', () => {
  it('restores spaces, items and files from the zip', async () => {
    const space = await addSpace({ name: 'Physics' });
    const item = await addItem({ title: 'Lab 2', spaceId: space.id, tags: ['lab'], status: 'todo', due: 123 });
    await addFile(item.id, new Blob(['hello pdf'], { type: 'application/pdf' }), 'lab2.pdf');
    const zip = await exportBackup();

    await Promise.all(db.tables.map((t) => t.clear()));
    const result = await importBackup(zip);

    expect(result).toEqual({ items: 1, spaces: 1, files: 1, skipped: 0 });
    expect(await db.items.get(item.id)).toMatchObject({ title: 'Lab 2', spaceId: space.id, tags: ['lab'], due: 123 });
    const file = (await db.files.toArray())[0];
    expect(file.name).toBe('lab2.pdf');
    expect(await file.blob.text()).toBe('hello pdf');
  });

  it('never overwrites newer local edits with an older backup', async () => {
    const item = await addItem({ title: 'old title' });
    const zip = await exportBackup();
    await new Promise((r) => setTimeout(r, 5));
    await updateItem(item.id, { title: 'newer title' });
    const result = await importBackup(zip);
    expect(result.items).toBe(0);
    expect((await db.items.get(item.id))?.title).toBe('newer title');
  });

  it('rejects files that are not Cove backups', async () => {
    await expect(importBackup(new Blob(['{"hello":1}']))).rejects.toThrow(/isn’t a Cove backup/);
    await expect(importBackup(new Blob(['{"format":"cove-backup","version":99}']))).rejects.toThrow(/newer version/);
  });
});

describe('toItem', () => {
  it('cleans hostile or broken records', () => {
    const item = toItem({
      id: 'abc',
      kind: 'script',
      title: 'x'.repeat(5000),
      url: 'javascript:alert(1)',
      status: 'hacked',
      priority: 9,
      tags: ['#Ok', 5, '<b>'],
      preview: { status: 'ok', image: 'data:text/html,hi' },
      recurrence: { freq: 'hourly', interval: 1 },
    })!;
    expect(item.kind).toBe('note');
    expect(item.title).toHaveLength(300);
    expect(item.url).toBeNull();
    expect(item.status).toBe('none');
    expect(item.priority).toBe(0);
    expect(item.tags).toEqual(['ok', 'b']);
    expect(item.preview?.image).toBeUndefined();
    expect(item.recurrence).toBeNull();
  });

  it('drops records without a usable id', () => {
    expect(toItem({ id: '../../etc' })).toBeNull();
    expect(toItem('nope')).toBeNull();
  });
});

describe('bookmarks', () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Bookmarks bar</H3>
  <DL><p>
    <DT><A HREF="https://developer.mozilla.org/" ADD_DATE="1700000000">MDN &amp; docs</A>
    <DT><H3>School</H3>
    <DL><p>
      <DT><A HREF="https://classroom.google.com/">Classroom</A>
      <DT><A HREF="javascript:void(0)">Bookmarklet</A>
    </DL><p>
    <DT><A HREF="https://github.com/">GitHub</A>
  </DL><p>
</DL>`;

  it('keeps folder names and skips non-web links', () => {
    expect(parseBookmarksHtml(html)).toEqual([
      { url: 'https://developer.mozilla.org/', title: 'MDN & docs', folder: 'Bookmarks bar', addedAt: 1_700_000_000_000 },
      { url: 'https://classroom.google.com/', title: 'Classroom', folder: 'School', addedAt: null },
      { url: 'https://github.com/', title: 'GitHub', folder: 'Bookmarks bar', addedAt: null },
    ]);
  });

  it('imports as tagged links without duplicates', async () => {
    await addItem({ kind: 'link', url: 'https://github.com/' });
    expect(await importBookmarks(html)).toBe(2);
    const classroom = (await db.items.toArray()).find((i) => i.url === 'https://classroom.google.com/');
    expect(classroom?.tags).toEqual(['bookmarks', 'school']);
  });
});

describe('itemToMarkdown', () => {
  it('writes front matter, the body and the checklist', async () => {
    const item = await addItem({ title: 'Essay', url: 'https://x.y/', tags: ['eng'], body: 'Thesis first.', checklist: [{ id: '1', text: 'outline', done: true }] });
    const md = itemToMarkdown(item, 'English');
    expect(md).toContain('title: "Essay"');
    expect(md).toContain('space: "English"');
    expect(md).toContain('tags: ["eng"]');
    expect(md).toContain('Thesis first.');
    expect(md).toContain('- [x] outline');
  });
});
