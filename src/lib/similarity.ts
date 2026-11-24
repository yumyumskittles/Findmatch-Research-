import type { BaselineFeatures, ItemCategory, RankedCandidate } from '../types';

export function histogramIntersection(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += Math.min(a[i], b[i]);
  }
  return Math.max(0, Math.min(1, sum));
}

export function dHashHammingDistance(hexA: string, hexB: string): number {
  const len = Math.min(hexA.length, hexB.length);
  let distance = 0;
  for (let i = 0; i < len; i++) {
    const valA = parseInt(hexA[i], 16);
    const valB = parseInt(hexB[i], 16);
    let xor = valA ^ valB;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  if (hexA.length !== hexB.length) {
    distance += Math.abs(hexA.length - hexB.length) * 4;
  }
  return distance;
}

export function computeBaselineScore(
  featA: BaselineFeatures,
  featB: BaselineFeatures,
): number {
  const histSim = histogramIntersection(featA.hsvHistogram, featB.hsvHistogram);
  const hamming = dHashHammingDistance(featA.dHashHex, featB.dHashHex);
  const hashSim = Math.max(0, 1 - hamming / 64);
  return Math.max(0, Math.min(1, 0.5 * histSim + 0.5 * hashSim));
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const len = Math.min(vecA.length, vecB.length);
  if (len === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function rescaleTextCosine(cos: number): number {
  // Sentence-embedding cosines: unrelated text is ~0.2, near-identical ~0.9.
  return Math.max(0, Math.min(1, (cos - 0.2) / 0.7));
}

export function computeTextScore(
  queryEmbedding: number[],
  itemEmbedding: number[],
  distinctiveMarkMatchCount: number,
): number {
  const cos = cosineSimilarity(queryEmbedding, itemEmbedding);
  const base = rescaleTextCosine(cos);
  const bonus = Math.max(0, distinctiveMarkMatchCount) * 0.1;
  return Math.max(0, Math.min(1, base + bonus));
}

export function normalizeCategory(raw: string | undefined | null): ItemCategory {
  const v = (raw || '').toLowerCase().trim();
  if (v.includes('bottle') || v.includes('flask') || v.includes('tumbler')) return 'bottle';
  if (v.includes('umbrella')) return 'umbrella';
  if (v.includes('bag') || v.includes('backpack') || v.includes('tote') || v.includes('pouch')) {
    return 'bag';
  }
  if (v.includes('charger') || v.includes('cable') || v.includes('adapter')) return 'charger';
  if (v.includes('id') || v.includes('badge') || v.includes('card holder') || v.includes('lanyard')) {
    return 'ID holder';
  }
  return 'other';
}

export function sortRankedCandidates(candidates: RankedCandidate[]): RankedCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    const scoreDiff = b.finalScore - a.finalScore;
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;

    const imgA = a.sImage ?? a.sBaseline;
    const imgB = b.sImage ?? b.sBaseline;
    const imgDiff = imgB - imgA;
    if (Math.abs(imgDiff) > 1e-9) return imgDiff;

    return a.itemId.localeCompare(b.itemId);
  });

  return sorted.map((c, idx) => ({
    ...c,
    rank: idx + 1,
  }));
}

export function formatScorePercent(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return '—';
  return `${Math.round(score * 100)}%`;
}

export function getConfidenceLabel(
  score: number,
): 'Strong candidate' | 'Possible candidate' | 'Low similarity' {
  const pct = score * 100;
  if (pct >= 75) return 'Strong candidate';
  if (pct >= 50) return 'Possible candidate';
  return 'Low similarity';
}
