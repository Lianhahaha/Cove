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

/** Plain-text preview of Markdown for list rows. */
export function markdownSnippet(src: string, max = 160): string {
  return src
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s*/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[#>*\-\s]+|[*_`~]/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
