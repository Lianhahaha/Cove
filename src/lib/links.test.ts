import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { setSetting } from './repo';
import { addQuickLink, isClassroom, loadQuickLinks, logoFor, quickLinks, removeQuickLink, toWebUrl } from './links';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await loadQuickLinks();
});

describe('toWebUrl', () => {
  it('adds https to bare addresses and keeps http(s) URLs', () => {
    expect(toWebUrl('classroom.google.com')).toBe('https://classroom.google.com/');
    expect(toWebUrl(' https://classroom.google.com/c/MTIz ')).toBe('https://classroom.google.com/c/MTIz');
    expect(toWebUrl('http://example.com/a?b=1')).toBe('http://example.com/a?b=1');
  });

  it('refuses other schemes and things that are not addresses', () => {
    expect(toWebUrl('javascript:alert(1)')).toBeNull();
    expect(toWebUrl('data:text/html,hi')).toBeNull();
    expect(toWebUrl('hello')).toBeNull();
    expect(toWebUrl('')).toBeNull();
  });
});

describe('quick links', () => {
  it('starts with Google Classroom', () => {
    expect(quickLinks.value.map((l) => l.name)).toEqual(['Classroom']);
    expect(isClassroom(quickLinks.value[0].url)).toBe(true);
  });

  it('adds, rejects duplicates and bad URLs, and removes for good', async () => {
    expect(await addQuickLink('Drive', 'drive.google.com')).toBeNull();
    expect(await addQuickLink('Drive again', 'https://drive.google.com/')).toMatch(/already/);
    expect(await addQuickLink('Bad', 'javascript:alert(1)')).toMatch(/web address/);
    expect(quickLinks.value.map((l) => l.name)).toEqual(['Classroom', 'Drive']);

    await removeQuickLink('classroom');
    await loadQuickLinks();
    expect(quickLinks.value.map((l) => l.name)).toEqual(['Drive']);
  });

  it('drops malformed saved entries', async () => {
    await setSetting('quickLinks', [{ id: 'a', name: 'Ok', url: 'https://ok.example' }, { id: 'b', name: 'Bad', url: 'javascript:x' }, 'junk']);
    await loadQuickLinks();
    expect(quickLinks.value).toEqual([{ id: 'a', name: 'Ok', url: 'https://ok.example/' }]);
  });

  it('uses bundled logos for Google apps and a safe saved icon for other sites', async () => {
    expect(logoFor({ url: 'https://classroom.google.com/' })).toBe('/brand/classroom.png');
    expect(logoFor({ url: 'https://mail.google.com/mail/u/0/' })).toBe('/brand/gmail.png');
    expect(logoFor({ url: 'https://portal.example.edu/' })).toBeUndefined();
    await setSetting('quickLinks', [
      { id: 'a', name: 'Portal', url: 'https://portal.example.edu', icon: 'https://portal.example.edu/favicon.ico' },
      { id: 'b', name: 'Sneaky', url: 'https://x.example', icon: 'javascript:alert(1)' },
    ]);
    await loadQuickLinks();
    expect(quickLinks.value.map((l) => l.icon)).toEqual(['https://portal.example.edu/favicon.ico', undefined]);
  });
});
