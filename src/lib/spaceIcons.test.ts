import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { addSpace } from './repo';
import { refreshDefaultSpaceIcons, suggestEmoji } from './spaceIcons';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('suggestEmoji', () => {
  it('matches the subject in the name', () => {
    expect(suggestEmoji('Computer architecture', [])).toBe('💻');
    expect(suggestEmoji('Digital Logic & Designs', [])).toBe('🔌');
    expect(suggestEmoji('Calculus 2', [])).toBe('🧮');
    expect(suggestEmoji('General Chemistry', [])).toBe('🧪');
    expect(suggestEmoji('PE 3', [])).toBe('🏀');
  });

  it('picks another fitting emoji when the first is taken', () => {
    expect(suggestEmoji('Discrete Math', ['🧮'])).toBe('📐');
  });

  it('falls back to an unused emoji for names it does not know', () => {
    expect(suggestEmoji('Random stuff', [])).toBe('📘');
    expect(suggestEmoji('Other stuff', ['📘'])).toBe('📗');
  });
});

describe('spaces', () => {
  it('get different emoji as they are added', async () => {
    const a = await addSpace({ name: 'Misc' });
    const b = await addSpace({ name: 'More misc' });
    expect(a.emoji).not.toBe(b.emoji);
  });

  it('keeps an emoji the user chose', async () => {
    expect((await addSpace({ name: 'Physics', emoji: '🚀' })).emoji).toBe('🚀');
  });

  it('once, replaces the old shared 📘 with emoji from each name', async () => {
    const a = await addSpace({ name: 'Computer architecture', emoji: '📘' });
    const b = await addSpace({ name: 'Digital Logic & Designs', emoji: '📘' });
    const c = await addSpace({ name: 'Art', emoji: '🎸' });
    await refreshDefaultSpaceIcons();
    expect((await db.spaces.get(a.id))?.emoji).toBe('💻');
    expect((await db.spaces.get(b.id))?.emoji).toBe('🔌');
    expect((await db.spaces.get(c.id))?.emoji).toBe('🎸');
    // A second run changes nothing, even if the user picks 📘 later.
    await db.spaces.update(a.id, { emoji: '📘' });
    await refreshDefaultSpaceIcons();
    expect((await db.spaces.get(a.id))?.emoji).toBe('📘');
  });
});
