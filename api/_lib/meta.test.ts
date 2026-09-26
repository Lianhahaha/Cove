import { describe, expect, it } from 'vitest';
import { decodeEntities, parseMeta } from './meta';

const page = new URL('https://example.com/articles/1');

describe('parseMeta', () => {
  it('prefers Open Graph tags and resolves relative URLs', () => {
    const html = `<html><head>
      <title>Fallback</title>
      <meta property="og:title" content="Ohm&#39;s Law &amp; You">
      <meta name="description" content="plain">
      <meta property="og:description" content="  Voltage,
        current and resistance ">
      <meta property="og:image" content="/img/cover.png">
      <meta property="og:site_name" content="Example">
      <link rel="icon" href="/favicon.svg">
    </head><body><meta property="og:title" content="ignored"></body></html>`;
    expect(parseMeta(html, page)).toEqual({
      title: "Ohm's Law & You",
      description: 'Voltage, current and resistance',
      image: 'https://example.com/img/cover.png',
      siteName: 'Example',
      favicon: 'https://example.com/favicon.svg',
    });
  });

  it('falls back to <title> and the default favicon', () => {
    const meta = parseMeta("<head><title>Just a title</title></head>", page);
    expect(meta.title).toBe('Just a title');
    expect(meta.favicon).toBe('https://example.com/favicon.ico');
  });

  it('drops non-http image URLs and strips markup from text', () => {
    const html = `<head><meta property="og:image" content="javascript:alert(1)"><meta property="og:title" content="&lt;b&gt;Hi&lt;/b&gt;"></head>`;
    const meta = parseMeta(html, page);
    expect(meta.image).toBeUndefined();
    expect(meta.title).toBe('Hi');
  });

  it('clamps very long values', () => {
    const html = `<head><meta name="description" content="${'x'.repeat(5000)}"></head>`;
    expect(parseMeta(html, page).description).toHaveLength(500);
  });
});

describe('decodeEntities', () => {
  it('handles named, decimal and hex entities', () => {
    expect(decodeEntities('&lt;a&gt; &#169; &#x1F600; &nbsp;x')).toBe('<a> © 😀  x');
  });
});
