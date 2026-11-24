import type { DistinctiveMark } from '../types';

// Words that signal a distinctive mark, grouped by mark type.
// Add more synonyms here if your testers describe things differently.
const MARK_GROUPS: Record<string, string[]> = {
  sticker: ['sticker', 'stickers', 'decal', 'decals'],
  scratch: ['scratch', 'scratches', 'scratched', 'scuff', 'scuffs', 'scuffed', 'scrape', 'scraped', 'scrapes'],
  dent: ['dent', 'dents', 'dented'],
  logo: ['logo', 'logos', 'emblem'],
  label: ['label', 'labels', 'tag', 'tags', 'nametag'],
  writing: ['writing', 'handwriting', 'handwritten', 'written', 'initials', 'engraved', 'engraving', 'marker'],
  pattern: ['pattern', 'patterned', 'stripe', 'stripes', 'striped', 'checkered', 'floral', 'polka'],
  wear: ['wear', 'worn', 'faded', 'fading', 'stain', 'stained', 'torn', 'frayed', 'rust', 'rusty', 'crack', 'cracked', 'chipped', 'chip'],
  pin: ['pin', 'pins', 'keychain', 'charm', 'patch', 'badge'],
};

const WORD_TO_TYPE = new Map<string, string>();
for (const [type, words] of Object.entries(MARK_GROUPS)) {
  for (const w of words) WORD_TO_TYPE.set(w, type);
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'on', 'in', 'at', 'near', 'to', 'by', 'it', 'its', 'is', 'has', 'have',
  'small', 'big', 'large', 'little', 'tiny', 'side', 'edge', 'bottom', 'top', 'front', 'back',
  'left', 'right', 'center', 'middle', 'part', 'area', 'some', 'there', 'that', 'this', 'and',
  'with', 'also', 'item', 'one', 'visible', 'slight', 'slightly', 'few', 'light', 'faint',
]);

const MATERIALS = [
  'stainless steel', 'aluminum', 'plastic', 'glass', 'canvas', 'leather', 'nylon',
  'rubber', 'silicone', 'polyester', 'metal', 'wood', 'fabric',
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Descriptive words of a mark (e.g. "star", "gold", "terra"), without generic words. */
export function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => t.length > 1 && !STOPWORDS.has(t) && !WORD_TO_TYPE.has(t));
}

/** Pulls distinctive marks (stickers, scratches, logos...) out of a plain-text description. */
export function extractMarksFromText(description: string): DistinctiveMark[] {
  const text = (description || '').trim();
  if (!text) return [];

  const clauses = text
    .split(/[.;,\n]|\band\b|\bwith\b|\bplus\b|\bplus\b/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const marks: DistinctiveMark[] = [];
  const seen = new Set<string>();
  for (const clause of clauses) {
    const words = tokenize(clause);
    const hit = words.find((w) => WORD_TO_TYPE.has(w));
    if (!hit) continue;
    const type = WORD_TO_TYPE.get(hit) as string;
    const key = `${type}:${contentTokens(clause).sort().join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const loc = /\b(?:on|near|at|along|inside|under|across)\s+(?:the\s+)?([^,.;]+)/i.exec(clause);
    marks.push({
      type,
      description: clause,
      location_on_item: loc ? loc[1].trim() : 'not specified',
    });
  }
  return marks;
}

/** Does a mark from the query appear among the candidate's marks / description? */
export function findMatchingMark(
  queryMark: DistinctiveMark,
  candidateMarks: DistinctiveMark[],
  candidateDescription: string,
): DistinctiveMark | null {
  const qTokens = contentTokens(queryMark.description);

  for (const cm of candidateMarks) {
    if (cm.type !== queryMark.type) continue;
    const cTokens = contentTokens(cm.description);
    // Query only said e.g. "scratch" (no detail) -> same type is enough.
    if (qTokens.length === 0) return cm;
    // Otherwise they must share at least one descriptive word (star, gold, handle, terra...).
    if (qTokens.some((t) => cTokens.includes(t))) return cm;
  }

  // Fallback: all descriptive words of the query mark appear in the candidate's description.
  if (qTokens.length > 0) {
    const descTokens = new Set(tokenize(candidateDescription));
    const sameTypeWordPresent = (MARK_GROUPS[queryMark.type] || []).some((w) => descTokens.has(w));
    if (sameTypeWordPresent && qTokens.every((t) => descTokens.has(t))) return queryMark;
  }
  return null;
}

export function detectCategoryFromText(description: string): string | null {
  const t = ` ${(description || '').toLowerCase()} `;
  if (/\b(bottle|flask|tumbler|thermos)\b/.test(t)) return 'bottle';
  if (/\bumbrella\b/.test(t)) return 'umbrella';
  if (/\b(bag|backpack|tote|pouch|satchel)\b/.test(t)) return 'bag';
  if (/\b(charger|cable|adapter|powerbank|power bank)\b/.test(t)) return 'charger';
  if (/\b(id holder|card holder|lanyard|id card|wallet)\b/.test(t)) return 'ID holder';
  return null;
}

export function detectMaterial(description: string): string {
  const t = (description || '').toLowerCase();
  const found = MATERIALS.filter((m) => t.includes(m));
  return found.length ? found.join(', ') : 'not specified';
}

export function detectBrand(description: string): string | null {
  const m = (description || '').match(/\b[A-Z]{3,}\b/);
  return m ? m[0] : null;
}
