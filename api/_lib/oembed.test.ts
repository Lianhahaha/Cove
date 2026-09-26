import { describe, expect, it } from 'vitest';
import { oembedUrl, parseOEmbed } from './oembed';

describe('oembed', () => {
  it('maps known hosts to their endpoint and ignores others', () => {
    expect(oembedUrl(new URL('https://youtu.be/abc'))).toBe('https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fyoutu.be%2Fabc');
    expect(oembedUrl(new URL('https://m.youtube.com/watch?v=x'))).toContain('youtube.com/oembed');
    expect(oembedUrl(new URL('https://notyoutube.com/watch'))).toBeNull();
    expect(oembedUrl(new URL('https://example.com'))).toBeNull();
  });

  it('parses and clamps the response', () => {
    const meta = parseOEmbed(JSON.stringify({ title: ' Lecture 1 ', author_name: 'Prof', thumbnail_url: 'https://i.ytimg.com/a.jpg', provider_name: 'YouTube' }));
    expect(meta).toEqual({ title: 'Lecture 1', description: 'by Prof', image: 'https://i.ytimg.com/a.jpg', siteName: 'YouTube' });
    expect(parseOEmbed(JSON.stringify({ title: 'x', thumbnail_url: 'javascript:1' }))?.image).toBeUndefined();
    expect(parseOEmbed('not json')).toBeNull();
  });
});
