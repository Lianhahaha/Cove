/**
 * Turns pasted lines into checklist steps. Bullets, numbering and checkboxes
 * are dropped, and a ticked box ("- [x]") comes in already done.
 */
export function stepsFromText(text: string): { text: string; done: boolean }[] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const m = /^\s*(?:(?:[-*+•]|\d+[.)])\s+)?(?:\[([ xX])\]\s*)?(.*)$/.exec(line)!;
      return { text: m[2].trim().slice(0, 300), done: m[1]?.toLowerCase() === 'x' };
    })
    .filter((s) => s.text);
}
