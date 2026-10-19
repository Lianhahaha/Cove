/**
 * Scores how well `query` matches `text` as a subsequence; higher is better.
 * Word starts and runs of adjacent letters score extra, so "gt" lands on
 * "Go to Tasks" while a hit buried mid-word scores lower. Null when a letter
 * of the query can't be placed at all.
 */
export function fuzzyScore(text: string, query: string): number | null {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let at = 0;
  let score = 0;
  let run = 0;
  for (const ch of q) {
    const i = t.indexOf(ch, at);
    if (i === -1) return null;
    run = i === at && at > 0 ? run + 1 : 0;
    score += 1 + Math.min(run, 4) + (i === 0 || t[i - 1] === ' ' ? 3 : 0);
    at = i + 1;
  }
  if (t.startsWith(q)) score += 12;
  else if (t.includes(q)) score += 6;
  return score;
}

/**
 * Every word of the query must match somewhere, and the scores add up, so
 * "go tasks" finds "Go to Tasks". An empty query matches everything for 0.
 */
export function fuzzyMatch(text: string, query: string): number | null {
  let total = 0;
  for (const word of query.split(/\s+/).filter(Boolean)) {
    const s = fuzzyScore(text, word);
    if (s === null) return null;
    total += s;
  }
  return total;
}
