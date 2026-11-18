import type { DistinctiveMark, VisualProfile } from '../types';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function extractVisualProfileApi(
  imageDataUrl: string,
  description?: string,
): Promise<VisualProfile> {
  const res = await postJson<{ profile: VisualProfile }>('/api/gemini/extract-profile', {
    imageBase64: imageDataUrl,
    mimeType: 'image/jpeg',
    description: description || '',
  });
  return res.profile;
}

export async function embedTextApi(text: string): Promise<number[]> {
  const res = await postJson<{ embedding: number[] }>('/api/gemini/embed', { text });
  return res.embedding;
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
  const res = await postJson<{ results: CompareResultItem[] }>('/api/gemini/compare', {
    queryImageBase64: payload.queryImageBase64,
    queryMimeType: 'image/jpeg',
    queryDescription: payload.queryDescription,
    queryProfile: payload.queryProfile,
    candidates: payload.candidates,
  });
  return res.results;
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
  const res = await postJson<{ matches: MarkMatchResultItem[] }>('/api/gemini/match-marks', payload);
  return res.matches;
}
