// Uses the database directly, not repo, because repo imports suggestEmoji from here.
import { db } from './db';

/**
 * Subjects and the emoji that fit them, checked in order, so "Computer architecture"
 * matches computer before architecture. Each lists a few, so two math classes differ.
 */
const RULES: [RegExp, string[]][] = [
  [/\b(computer|programming|coding|software|comp ?sci|web dev|app dev|oop|java|python)/i, ['💻', '🖥️', '⌨️']],
  [/\b(logic|circuit|electronic|electrical|microcontroller|microprocessor|embedded|signals?)\b/i, ['🔌', '⚡', '🔋']],
  [/\b(network|internet|cyber|security)/i, ['🌐', '🛡️']],
  [/\b(data|database|sql|information)/i, ['🗄️', '📊']],
  [/\b(ai|artificial|machine learning|robot)/i, ['🤖', '🧠']],
  [/\b(statistic|probability)/i, ['📊', '📉']],
  [/\b(calculus|algebra|math|trigo|geometry|discrete|numerical|differential)/i, ['🧮', '📐', '📏']],
  [/\b(physics|mechanics|thermo|dynamics|statics)/i, ['⚛️', '🔭']],
  [/\bchem/i, ['🧪', '⚗️']],
  [/\b(bio|anatomy|genetic|physiology|zoology|botany)/i, ['🧬', '🌿']],
  [/\b(science|lab)\b/i, ['🔬', '🧫']],
  [/\b(english|literature|writing|reading|communication|journalism)/i, ['✍️', '📖']],
  [/\b(filipino|language|spanish|japanese|korean|mandarin|french|german|speech)/i, ['🗣️', '💬']],
  [/\b(history|rizal|social|politic|government|sociology|anthropology)/i, ['🏛️', '🌏']],
  [/\b(econ|business|account|finance|marketing|management|entrepreneur|tax)/i, ['📈', '💼', '🧾']],
  [/\b(art|drawing|design|drafting|photography)/i, ['🎨', '🖌️']],
  [/\bmusic/i, ['🎵', '🎸']],
  [/\b(pe|physical education|pathfit|sports?|fitness|nstp)\b/i, ['🏀', '⚽']],
  [/\bpsych/i, ['🧠', '💭']],
  [/\b(philosophy|ethics|law|theology|religion)/i, ['⚖️', '🕊️']],
  [/\b(thesis|research|capstone)/i, ['🎓', '🔎']],
  [/\b(architecture|engineering)/i, ['📐', '🏗️']],
  [/\b(work|job|internship|ojt)\b/i, ['💼', '🗂️']],
  [/\b(personal|home|life|health)\b/i, ['🏠', '❤️']],
];

/** Varied fallbacks for names with no match, so spaces never all look the same. */
const FALLBACKS = ['📘', '📗', '📙', '📕', '📓', '💡', '⭐', '🚀', '🧭', '🌱', '🎯', '🗂️'];

/** An emoji that fits the space's name and isn't used by another space yet. */
export function suggestEmoji(name: string, used: Iterable<string>): string {
  const taken = new Set(used);
  for (const [pattern, emojis] of RULES) {
    if (!pattern.test(name)) continue;
    const free = emojis.find((e) => !taken.has(e));
    if (free) return free;
  }
  return FALLBACKS.find((e) => !taken.has(e)) ?? FALLBACKS[taken.size % FALLBACKS.length];
}

/**
 * Every space used to start as 📘. Once, give each space still on it an emoji from
 * its name, so the sidebar and Home can tell them apart.
 */
export async function refreshDefaultSpaceIcons(): Promise<void> {
  if ((await db.settings.get('spaceIconsV2'))?.value) return;
  const spaces = (await db.spaces.orderBy('order').toArray()).filter((s) => !s.deletedAt);
  const used = new Set(spaces.filter((s) => s.emoji !== '📘').map((s) => s.emoji));
  for (const s of spaces) {
    if (s.emoji !== '📘') continue;
    const emoji = suggestEmoji(s.name, used);
    used.add(emoji);
    if (emoji !== s.emoji) await db.spaces.update(s.id, { emoji, updatedAt: Date.now() });
  }
  await db.settings.put({ key: 'spaceIconsV2', value: true });
}
