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
