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

/** Words a reader sees, and minutes to read them at about 200 words a minute. */
export function readingStats(src: string): { words: number; minutes: number } {
  const words = markdownSnippet(src, Infinity)
    .split(' ')
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return { words, minutes: Math.max(1, Math.round(words / 200)) };
}
