import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { addFile, updateItem } from './repo';
import { createNote, discardIfBlank } from './notes';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('notes', () => {
  it('creates an empty note in the given space', async () => {
    const note = await createNote('s1');
    expect(note).toMatchObject({ kind: 'note', title: '', body: '', spaceId: 's1', status: 'none' });
    expect(await db.items.get(note.id)).toBeTruthy();
  });

  it('turns the first line of text into the title', async () => {
    expect(await createNote(null, 'Thesis intro\n\n- hook\n- gap')).toMatchObject({ title: 'Thesis intro', body: '- hook\n- gap' });
    expect(await createNote(null, '  One line  ')).toMatchObject({ title: 'One line', body: '' });
  });

  it('discards a note left empty', async () => {
    const note = await createNote();
    await updateItem(note.id, { title: '   ', body: '\n' });
    expect(await discardIfBlank(note.id)).toBe(true);
    expect(await db.items.get(note.id)).toBeUndefined();
  });

  it('keeps a note with any content', async () => {
    const withTitle = await createNote();
    await updateItem(withTitle.id, { title: 'Lecture 3' });
    const withTag = await createNote();
    await updateItem(withTag.id, { tags: ['lab'] });
    const withFile = await createNote();
    await addFile(withFile.id, new Blob(['x'], { type: 'text/plain' }), 'x.txt');
    for (const n of [withTitle, withTag, withFile]) {
      expect(await discardIfBlank(n.id)).toBe(false);
      expect(await db.items.get(n.id)).toBeTruthy();
    }
  });

  it('never discards links or tasks', async () => {
    const task = await createNote();
    await updateItem(task.id, { status: 'todo' });
    expect(await discardIfBlank(task.id)).toBe(false);
  });
});
