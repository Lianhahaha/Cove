/** Tags added automatically to links from sites students use a lot. */
const RULES: [RegExp, string][] = [
  [/(^|\.)youtube\.com$|^youtu\.be$|(^|\.)vimeo\.com$/, 'video'],
  [/(^|\.)github\.com$|(^|\.)gitlab\.com$|(^|\.)stackoverflow\.com$/, 'code'],
  [/^docs\.google\.com$/, 'docs'],
  [/^drive\.google\.com$/, 'drive'],
  [/^classroom\.google\.com$/, 'classroom'],
  [/^meet\.google\.com$|(^|\.)zoom\.us$|^teams\.microsoft\.com$/, 'meeting'],
  [/(^|\.)canva\.com$|(^|\.)figma\.com$/, 'design'],
  [/(^|\.)arxiv\.org$|(^|\.)scholar\.google\.com$|(^|\.)researchgate\.net$|(^|\.)doi\.org$|(^|\.)sciencedirect\.com$/, 'research'],
  [/(^|\.)wikipedia\.org$/, 'wiki'],
  [/(^|\.)notion\.(so|site)$/, 'notion'],
  [/(^|\.)quizlet\.com$|(^|\.)khanacademy\.org$|(^|\.)coursera\.org$|(^|\.)udemy\.com$/, 'learning'],
];

export function autoTagsFor(url: string | null): string[] {
  if (!url) return [];
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return RULES.filter(([re]) => re.test(host)).map(([, tag]) => tag);
  } catch {
    return [];
  }
}
