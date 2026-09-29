import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { setSetting } from './repo';
import { addQuickLink, friendlyName, isClassroom, loadQuickLinks, logoFor, moveQuickLink, quickLinks, removeQuickLink, toWebUrl } from './links';

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

  it('takes ports, localhost and full addresses of single-name hosts', () => {
    expect(toWebUrl('localhost:5173')).toBe('https://localhost:5173/');
    expect(toWebUrl('moodle.school.edu:8443/course')).toBe('https://moodle.school.edu:8443/course');
    expect(toWebUrl('http://intranet/wiki')).toBe('http://intranet/wiki');
    expect(toWebUrl('intranet')).toBeNull();
  });

  it('refuses a space in the site name but allows one later in the address', () => {
    expect(toWebUrl('exa mple.com')).toBeNull();
    expect(toWebUrl('https://my school.edu/')).toBeNull();
    expect(toWebUrl('example.com/my notes.pdf')).toBe('https://example.com/my%20notes.pdf');
  });
});

describe('friendlyName', () => {
  it('names a tile from its address', () => {
    expect(friendlyName('https://www.wikipedia.org/')).toBe('Wikipedia');
    expect(friendlyName('https://portal.myschool.edu/')).toBe('Myschool');
    expect(friendlyName('https://dlsu.edu.ph/')).toBe('DLSU');
    expect(friendlyName('https://canvas.instructure.com/')).toBe('Instructure');
  });
});

describe('quick links', () => {
  it('starts with Google Classroom and Gmail', () => {
    expect(quickLinks.value.map((l) => l.name)).toEqual(['Classroom', 'Gmail']);
    expect(isClassroom(quickLinks.value[0].url)).toBe(true);
  });

  it('adds, rejects duplicates and bad URLs, and removes for good', async () => {
    expect(await addQuickLink('Drive', 'drive.google.com')).toBeNull();
    expect(await addQuickLink('Drive again', 'https://drive.google.com/')).toMatch(/already/);
    expect(await addQuickLink('Bad', 'javascript:alert(1)')).toMatch(/web address/);
    expect(quickLinks.value.map((l) => l.name)).toEqual(['Classroom', 'Gmail', 'Drive']);

    const undo = await removeQuickLink('classroom');
    await loadQuickLinks();
    expect(quickLinks.value.map((l) => l.name)).toEqual(['Gmail', 'Drive']);

    await undo();
    await loadQuickLinks();
    expect(quickLinks.value.map((l) => l.name)).toEqual(['Classroom', 'Gmail', 'Drive']);
  });

  it('won’t undo a removal into a full list', async () => {
    for (let n = 0; n < 10; n++) await addQuickLink('', `site${n}.example.com`);
    const undo = await removeQuickLink('classroom');
    await addQuickLink('Drive', 'drive.google.com');
    expect(await undo()).toBe(false);
    expect(quickLinks.value.some((l) => l.name === 'Drive')).toBe(true);
    expect(quickLinks.value).toHaveLength(12);
  });

  it('moves a link left or right, stopping at the ends', async () => {
    await addQuickLink('Drive', 'drive.google.com');
    const id = quickLinks.value[2].id;
    await moveQuickLink(id, -1);
    await moveQuickLink(id, -1);
    await moveQuickLink(id, -1);
    await loadQuickLinks();
    expect(quickLinks.value.map((l) => l.name)).toEqual(['Drive', 'Classroom', 'Gmail']);
    await moveQuickLink('gmail', 1);
    expect(quickLinks.value.map((l) => l.name)).toEqual(['Drive', 'Classroom', 'Gmail']);
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
