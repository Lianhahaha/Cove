import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.use({ gfm: true, breaks: true });

// Links in notes open in a new tab and never pass the referrer or page access.
// DOMPurify needs a DOM, so there's nothing to hook in Node (tests).
if (DOMPurify.isSupported) {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
}

/** Markdown to sanitized HTML. Never render note content any other way. */
export function renderMarkdown(src: string): string {
  const html = marked.parse(src, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'iframe', 'form', 'object', 'embed', 'svg', 'math'],
    FORBID_ATTR: ['style'],
  });
}
