import type { DistinctiveMark, VisualProfile } from '../types';
import {
  classifyCategory,
  dominantColors,
  embedImage,
  embedSentence,
  imageSimilarity,
} from './localAI';
import {
  detectBrand,
  detectCategoryFromText,
  detectMaterial,
  extractMarksFromText,
  findMatchingMark,
} from './textMarks';

// ---------------------------------------------------------------------------
// Tunable numbers (adjust these after you try real photos)
// ---------------------------------------------------------------------------
// Raw photo similarity (0..1) below FLOOR scores 0, above CEIL scores 1.
const IMAGE_SIM_FLOOR = 0.6;
const IMAGE_SIM_CEIL = 0.98;
// Score bonus / penalty per described mark that is found / missing on the item.
const MARK_MATCH_BONUS = 0.12;
const MARK_CONFLICT_PENALTY = 0.15;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export async function extractVisualProfileApi(
  imageDataUrl: string,
  description?: string,
): Promise<VisualProfile> {
  const desc = (description || '').trim();
  const [embeddings, colors] = await Promise.all([
    embedImage(imageDataUrl),
    dominantColors(imageDataUrl),
  ]);

  // The words you typed win; otherwise guess the category from the photo.
  const category = detectCategoryFromText(desc) ?? (await classifyCategory(embeddings));
  const marks = extractMarksFromText(desc);

  const captionParts = [`${colors.join(' and ')} ${category}`.trim()];
  if (marks.length > 0) captionParts.push(`with ${marks.map((m) => m.description).join('; ')}`);

  return {
    category,
    main_colors: colors,
    brand_or_logo: detectBrand(desc),
    shape_material: detectMaterial(desc),
    distinctive_marks: marks,
    caption: captionParts.join(' '),
  };
}

export async function embedTextApi(text: string): Promise<number[]> {
  return embedSentence(text);
}

export interface CompareCandidatePayload {
  item_id: string;
  imageBase64: string;
  mimeType: string;
  description: string;
  profile: VisualProfile;
}

export interface CompareResultItem {
  item_id: string;
  visual_score: number;
  matching_features: string[];
  conflicting_features: string[];
  reason: string;
}

export async function compareCandidatesApi(payload: {
  queryImageBase64: string;
  queryDescription: string;
  queryProfile: VisualProfile;
  candidates: CompareCandidatePayload[];
}): Promise<CompareResultItem[]> {
  const queryEmb = await embedImage(payload.queryImageBase64);
  const queryMarks = payload.queryProfile.distinctive_marks || [];
  const results: CompareResultItem[] = [];

  for (const cand of payload.candidates) {
    const candEmb = await embedImage(cand.imageBase64);
    const rawSim = imageSimilarity(queryEmb, candEmb);
    let score = clamp01((rawSim - IMAGE_SIM_FLOOR) / (IMAGE_SIM_CEIL - IMAGE_SIM_FLOOR));

    const matching: string[] = [];
    const conflicting: string[] = [];
    const candMarks = cand.profile?.distinctive_marks || [];

    for (const qm of queryMarks) {
      const hit = findMatchingMark(qm, candMarks, cand.description || '');
      if (hit) {
        matching.push(`Both show: ${qm.description}`);
        score += MARK_MATCH_BONUS;
      } else {
        conflicting.push(`Described "${qm.description}" is not listed on this item`);
        score -= MARK_CONFLICT_PENALTY;
      }
    }
    score = clamp01(score);

    const simPct = Math.round(clamp01(rawSim) * 100);
    results.push({
      item_id: cand.item_id,
      visual_score: score,
      matching_features: matching,
      conflicting_features: conflicting,
      reason:
        `Overall photo similarity ${simPct}%. ` +
        (matching.length ? `${matching.length} described mark(s) found. ` : '') +
        (conflicting.length ? `${conflicting.length} described mark(s) not found.` : ''),
    });
  }
  return results;
}

export interface MarkMatchResultItem {
  item_id: string;
  matched_count: number;
  matched_terms: string[];
}

export async function matchDistinctiveMarksApi(payload: {
  queryDescription: string;
  queryMarks: DistinctiveMark[];
  candidates: Array<{
    item_id: string;
    description: string;
    marks: DistinctiveMark[];
  }>;
}): Promise<MarkMatchResultItem[]> {
  return payload.candidates.map((cand) => {
    const terms: string[] = [];
    for (const qm of payload.queryMarks) {
      if (findMatchingMark(qm, cand.marks || [], cand.description || '')) {
        terms.push(qm.description);
      }
    }
    return { item_id: cand.item_id, matched_count: terms.length, matched_terms: terms };
  });
}
