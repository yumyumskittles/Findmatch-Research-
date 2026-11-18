import type {
  FoundItem,
  ItemCategory,
  MatchConfig,
  RankedCandidate,
  SearchExecutionResult,
  SearchLogEntry,
  TestCaseId,
  VisualProfile,
} from '../types';
import {
  compareCandidatesApi,
  embedTextApi,
  extractVisualProfileApi,
  matchDistinctiveMarksApi,
  type CompareResultItem,
  type MarkMatchResultItem,
} from './api';
import {
  getCacheValue,
  getNextItemId,
  saveFoundItem,
  saveSearchLog,
  setCacheValue,
} from './db';
import {
  recomputeBaselineFromDataUrl,
  validateAndPreprocessImage,
  type ProcessedImageResult,
} from './imageProcessor';
import {
  computeBaselineScore,
  computeTextScore,
  normalizeCategory,
  sortRankedCandidates,
} from './similarity';

export function buildEmbeddingSourceText(
  userDescription: string,
  profile: VisualProfile,
): string {
  const marksText = (profile.distinctive_marks || [])
    .map((m) => `${m.type}: ${m.description} (${m.location_on_item})`)
    .join('; ');
  return [userDescription.trim(), profile.caption?.trim() || '', marksText]
    .filter(Boolean)
    .join(' | ');
}

export async function indexFoundItemFromProcessed(params: {
  processed: ProcessedImageResult;
  category: ItemCategory;
  description: string;
  locationFound: string;
  dateFound: string;
  existingItem?: FoundItem;
}): Promise<FoundItem> {
  const { processed, category, description, locationFound, dateFound, existingItem } =
    params;

  const profileCacheKey = `profile::${processed.imageHash}::${description.trim()}`;
  let visualProfile = await getCacheValue<VisualProfile>(profileCacheKey);
  if (!visualProfile) {
    visualProfile = await extractVisualProfileApi(processed.imageDataUrl, description);
    await setCacheValue(profileCacheKey, visualProfile);
  }

  const embedText = buildEmbeddingSourceText(description, visualProfile);
  const embedCacheKey = `embed::${processed.imageHash}::${embedText}`;
  let textEmbedding = await getCacheValue<number[]>(embedCacheKey);
  if (!textEmbedding) {
    textEmbedding = await embedTextApi(embedText || `${category} lost item`);
    await setCacheValue(embedCacheKey, textEmbedding);
  }

  const now = new Date().toISOString();
  const id = existingItem ? existingItem.id : await getNextItemId();

  const item: FoundItem = {
    id,
    imageDataUrl: processed.imageDataUrl,
    imageHash: processed.imageHash,
    category,
    description: description.trim(),
    locationFound: locationFound.trim() || 'Lost & Found Desk',
    dateFound: dateFound || now.slice(0, 10),
    createdAt: existingItem?.createdAt || now,
    updatedAt: now,
    baselineFeatures: processed.baselineFeatures,
    visualProfile,
    textEmbedding,
    verificationStatus: existingItem?.verificationStatus || 'available',
    verificationRequestedAt: existingItem?.verificationRequestedAt,
  };

  await saveFoundItem(item);
  return item;
}

export async function registerFoundItem(params: {
  file: File;
  category: ItemCategory;
  description: string;
  locationFound: string;
  dateFound: string;
}): Promise<FoundItem> {
  const processed = await validateAndPreprocessImage(params.file);
  return indexFoundItemFromProcessed({
    processed,
    category: params.category,
    description: params.description,
    locationFound: params.locationFound,
    dateFound: params.dateFound,
  });
}

export async function reindexFoundItem(item: FoundItem): Promise<FoundItem> {
  const baselineFeatures = await recomputeBaselineFromDataUrl(item.imageDataUrl);
  const visualProfile = await extractVisualProfileApi(item.imageDataUrl, item.description);
  const embedText = buildEmbeddingSourceText(item.description, visualProfile);
  const textEmbedding = await embedTextApi(embedText || `${item.category} lost item`);

  // Update caches cleanly
  await setCacheValue(
    `profile::${item.imageHash}::${item.description.trim()}`,
    visualProfile,
  );
  await setCacheValue(`embed::${item.imageHash}::${embedText}`, textEmbedding);

  const updated: FoundItem = {
    ...item,
    updatedAt: new Date().toISOString(),
    baselineFeatures,
    visualProfile,
    textEmbedding,
  };
  await saveFoundItem(updated);
  return updated;
}

export interface SearchProgressUpdate {
  stage: string;
  percent: number;
}

function sanitizeText(text: string): string {
  // Guard against forbidden phrases in model outputs
  return text
    .replace(/\bconfirmed\b/gi, 'noted')
    .replace(/\bmatch found\b/gi, 'candidate observed')
    .replace(/\bthis is your item\b/gi, 'this item shares visual traits');
}

export async function executeLostItemSearch(params: {
  processedQuery: ProcessedImageResult;
  queryDescription: string;
  items: FoundItem[];
  config: MatchConfig;
  alpha: number;
  expectedItemId?: string;
  testCaseTag?: TestCaseId | '';
  onProgress?: (update: SearchProgressUpdate) => void;
}): Promise<SearchExecutionResult> {
  const {
    processedQuery,
    queryDescription,
    items,
    config,
    alpha,
    expectedItemId,
    testCaseTag,
    onProgress,
  } = params;

  const trimmedDesc = queryDescription.trim();
  const hasDescription = trimmedDesc.length > 0;
  let geminiCallsMade = 0;

  if (config === 'text-only' && !hasDescription) {
    const emptyLog: SearchLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      config,
      alphaConfigured: alpha,
      alphaEffective: 0,
      queryDescription: trimmedDesc,
      queryImageHash: processedQuery.imageHash,
      expectedItemId: expectedItemId?.trim() || undefined,
      testCaseTag: testCaseTag || undefined,
      usedImageOnlyFallback: false,
      validationError: 'Text-only needs a description',
      geminiCallsMade: 0,
      rankedList: [],
      databaseItemCount: items.length,
      databaseCategoryCounts: countCategories(items),
    };
    return {
      logEntry: emptyLog,
      rankedCandidates: [],
      usedImageOnlyFallback: false,
      alphaEffective: 0,
      noStrongMatch: false,
      textOnlyEmptyDescription: true,
    };
  }

  onProgress?.({ stage: 'Computing baseline color & hash similarity...', percent: 15 });

  // 1. Baseline score for every item
  const baselineMap = new Map<string, number>();
  for (const item of items) {
    const sBase = computeBaselineScore(processedQuery.baselineFeatures, item.baselineFeatures);
    baselineMap.set(item.id, sBase);
  }

  // Pure baseline mode requires 0 Gemini calls
  if (config === 'baseline') {
    const rawCandidates: RankedCandidate[] = items.map((item) => {
      const sBase = baselineMap.get(item.id) ?? 0;
      return {
        itemId: item.id,
        item,
        rank: 0,
        finalScore: sBase,
        sBaseline: sBase,
        sImage: null,
        sText: null,
        matchingFeatures: [],
        conflictingFeatures: [],
        reason: 'Ranked by local HSV color histogram and 64-bit dHash similarity.',
        shortlisted: false,
      };
    });

    const ranked = sortRankedCandidates(rawCandidates);
    const logEntry = buildLogEntry({
      config,
      alphaConfigured: alpha,
      alphaEffective: 1.0,
      queryDescription: trimmedDesc,
      queryImageHash: processedQuery.imageHash,
      expectedItemId,
      testCaseTag,
      usedImageOnlyFallback: false,
      geminiCallsMade: 0,
      ranked,
      items,
    });
    await saveSearchLog(logEntry);

    return {
      logEntry,
      rankedCandidates: ranked,
      usedImageOnlyFallback: false,
      alphaEffective: 1.0,
      noStrongMatch: ranked.length > 0 && ranked[0].finalScore < 0.5,
      textOnlyEmptyDescription: false,
    };
  }

  // Check full-search cache keyed by (imageHash + description + config + alpha + dbSignature)
  // Wait: cache Gemini visual profile, embedding, comparisons, and mark matches independently
  // so repeated searches with the same (imageHash + description + config) return identical scores!
  const dbSig = items.map((i) => `${i.id}:${i.imageHash}:${i.updatedAt}`).join(',');
  const searchCacheKey = `search::${processedQuery.imageHash}::${trimmedDesc}::${config}::${alpha.toFixed(2)}::${dbSig}`;
  const cachedResult = await getCacheValue<{
    queryCategory: string;
    rankedData: Array<{
      itemId: string;
      finalScore: number;
      sBaseline: number;
      sImage: number | null;
      sText: number | null;
      matchingFeatures: string[];
      conflictingFeatures: string[];
      reason: string;
      shortlisted: boolean;
    }>;
    usedImageOnlyFallback: boolean;
    alphaEffective: number;
  }>(searchCacheKey);

  if (cachedResult) {
    onProgress?.({ stage: 'Loading cached Gemini scores...', percent: 95 });
    const itemById = new Map(items.map((i) => [i.id, i]));
    const reconstructed: RankedCandidate[] = [];
    for (const r of cachedResult.rankedData) {
      const item = itemById.get(r.itemId);
      if (item) {
        reconstructed.push({
          ...r,
          item,
          rank: 0,
        });
      }
    }
    const ranked = sortRankedCandidates(reconstructed);
    const logEntry = buildLogEntry({
      config,
      alphaConfigured: alpha,
      alphaEffective: cachedResult.alphaEffective,
      queryDescription: trimmedDesc,
      queryImageHash: processedQuery.imageHash,
      queryCategory: cachedResult.queryCategory,
      expectedItemId,
      testCaseTag,
      usedImageOnlyFallback: cachedResult.usedImageOnlyFallback,
      geminiCallsMade: 0,
      ranked,
      items,
    });
    await saveSearchLog(logEntry);
    return {
      logEntry,
      rankedCandidates: ranked,
      usedImageOnlyFallback: cachedResult.usedImageOnlyFallback,
      alphaEffective: cachedResult.alphaEffective,
      noStrongMatch: ranked.length > 0 && ranked[0].finalScore < 0.5,
      textOnlyEmptyDescription: false,
    };
  }

  // 2. Extract query visual profile (cached by imageHash + description)
  onProgress?.({ stage: 'Extracting visual profile & distinctive marks...', percent: 30 });
  const qProfileKey = `qprofile::${processedQuery.imageHash}::${trimmedDesc}`;
  let queryProfile = await getCacheValue<VisualProfile>(qProfileKey);
  if (!queryProfile) {
    queryProfile = await extractVisualProfileApi(processedQuery.imageDataUrl, trimmedDesc);
    geminiCallsMade++;
    await setCacheValue(qProfileKey, queryProfile);
  }
  const queryCategory = normalizeCategory(queryProfile.category);

  // 3. Extract query text embedding ONLY if description is non-empty
  let queryEmbedding: number[] | null = null;
  if (hasDescription && (config === 'text-only' || config === 'combined')) {
    onProgress?.({ stage: 'Generating text embedding...', percent: 45 });
    const queryEmbedText = buildEmbeddingSourceText(trimmedDesc, queryProfile);
    const qEmbedKey = `qembed::${processedQuery.imageHash}::${queryEmbedText}`;
    queryEmbedding = await getCacheValue<number[]>(qEmbedKey);
    if (!queryEmbedding) {
      queryEmbedding = await embedTextApi(queryEmbedText);
      geminiCallsMade++;
      await setCacheValue(qEmbedKey, queryEmbedding);
    }
  }

  // 4. Shortlist and fine-grained visual comparison S_image
  const sImageMap = new Map<string, CompareResultItem & { shortlisted: boolean }>();
  if (config === 'image-only' || config === 'combined') {
    onProgress?.({ stage: 'Comparing fine-grained visual details...', percent: 60 });
    const shortlist = selectShortlist(items, baselineMap, queryCategory);
    const shortlistIds = new Set(shortlist.map((i) => i.id));

    const toFetch: FoundItem[] = [];
    for (const cand of shortlist) {
      const pairKey = `pair::${processedQuery.imageHash}::${trimmedDesc}::${cand.id}::${cand.imageHash}`;
      const cachedPair = await getCacheValue<CompareResultItem>(pairKey);
      if (cachedPair) {
        sImageMap.set(cand.id, { ...cachedPair, shortlisted: true });
      } else {
        toFetch.push(cand);
      }
    }

    // Batch in groups of up to 5 candidates per call
    for (let i = 0; i < toFetch.length; i += 5) {
      const batch = toFetch.slice(i, i + 5);
      const batchResults = await compareCandidatesApi({
        queryImageBase64: processedQuery.imageDataUrl,
        queryDescription: trimmedDesc,
        queryProfile,
        candidates: batch.map((c) => ({
          item_id: c.id,
          imageBase64: c.imageDataUrl,
          mimeType: 'image/jpeg',
          description: c.description,
          profile: c.visualProfile,
        })),
      });
      geminiCallsMade++;

      const resultById = new Map(batchResults.map((r) => [r.item_id, r]));
      for (const cand of batch) {
        const res = resultById.get(cand.id);
        const normalized: CompareResultItem = res
          ? {
              item_id: cand.id,
              visual_score: Math.max(0, Math.min(1, Number(res.visual_score) || 0)),
              matching_features: (res.matching_features || []).map(sanitizeText),
              conflicting_features: (res.conflicting_features || []).map(sanitizeText),
              reason: sanitizeText(res.reason || 'Visual comparison completed.'),
            }
          : {
              item_id: cand.id,
              visual_score: (baselineMap.get(cand.id) ?? 0) * 0.5,
              matching_features: [],
              conflicting_features: [],
              reason: 'Fallback baseline visual estimate.',
            };
        const pairKey = `pair::${processedQuery.imageHash}::${trimmedDesc}::${cand.id}::${cand.imageHash}`;
        await setCacheValue(pairKey, normalized);
        sImageMap.set(cand.id, { ...normalized, shortlisted: true });
      }
    }

    // Non-shortlisted items get S_image = S_baseline * 0.5
    for (const item of items) {
      if (!shortlistIds.has(item.id)) {
        const sBase = baselineMap.get(item.id) ?? 0;
        sImageMap.set(item.id, {
          item_id: item.id,
          visual_score: Math.max(0, Math.min(1, sBase * 0.5)),
          matching_features: [],
          conflicting_features: [],
          reason: 'Not shortlisted by visual pre-filter; scored from baseline similarity.',
          shortlisted: false,
        });
      }
    }
  }

  // 5. Text score S_text (if description provided & config uses text)
  const sTextMap = new Map<string, number>();
  const matchedMarkTermsMap = new Map<string, string[]>();
  if (queryEmbedding && hasDescription && (config === 'text-only' || config === 'combined')) {
    onProgress?.({ stage: 'Evaluating distinctive mark descriptions...', percent: 85 });

    const markKey = `marks::${trimmedDesc}::${dbSig}`;
    let markMatches = await getCacheValue<MarkMatchResultItem[]>(markKey);
    if (!markMatches) {
      markMatches = await matchDistinctiveMarksApi({
        queryDescription: trimmedDesc,
        queryMarks: queryProfile.distinctive_marks || [],
        candidates: items.map((item) => ({
          item_id: item.id,
          description: item.description,
          marks: item.visualProfile.distinctive_marks || [],
        })),
      });
      geminiCallsMade++;
      await setCacheValue(markKey, markMatches);
    }

    const markCountById = new Map<string, number>();
    for (const m of markMatches) {
      markCountById.set(m.item_id, m.matched_count || 0);
      if (m.matched_terms && m.matched_terms.length > 0) {
        matchedMarkTermsMap.set(m.item_id, m.matched_terms);
      }
    }

    for (const item of items) {
      const bonusCount = markCountById.get(item.id) ?? 0;
      const sText = computeTextScore(queryEmbedding, item.textEmbedding, bonusCount);
      sTextMap.set(item.id, sText);
    }
  }

  // 6. Combine scores according to configuration
  const usedImageOnlyFallback = config === 'combined' && !hasDescription;
  const alphaEffective =
    config === 'image-only' || usedImageOnlyFallback
      ? 1.0
      : config === 'text-only'
        ? 0.0
        : alpha;

  const rawCandidates: RankedCandidate[] = items.map((item) => {
    const sBaseline = baselineMap.get(item.id) ?? 0;
    const imgRes = sImageMap.get(item.id);
    const sImage = imgRes ? imgRes.visual_score : null;
    const sText = sTextMap.has(item.id) ? sTextMap.get(item.id)! : null;

    let finalScore = 0;
    if (config === 'image-only') {
      finalScore = sImage ?? 0;
    } else if (config === 'text-only') {
      finalScore = sText ?? 0;
    } else {
      // combined
      if (usedImageOnlyFallback) {
        finalScore = sImage ?? 0;
      } else {
        finalScore = alphaEffective * (sImage ?? 0) + (1 - alphaEffective) * (sText ?? 0);
      }
    }

    const markTerms = matchedMarkTermsMap.get(item.id) || [];
    const matchingFeatures = imgRes
      ? Array.from(new Set([...imgRes.matching_features, ...markTerms.map((t) => `Mark: ${t}`)]))
      : markTerms.map((t) => `Mark: ${t}`);

    return {
      itemId: item.id,
      item,
      rank: 0,
      finalScore: Math.max(0, Math.min(1, finalScore)),
      sBaseline,
      sImage,
      sText,
      matchingFeatures,
      conflictingFeatures: imgRes?.conflicting_features ?? [],
      reason:
        imgRes?.reason ||
        (config === 'text-only'
          ? 'Ranked by semantic text embedding and distinctive mark match.'
          : 'Visual and text analysis completed.'),
      shortlisted: imgRes?.shortlisted ?? false,
    };
  });

  const ranked = sortRankedCandidates(rawCandidates);

  // Cache full search results for exact deterministic repeatability
  await setCacheValue(searchCacheKey, {
    queryCategory,
    rankedData: ranked.map((r) => ({
      itemId: r.itemId,
      finalScore: r.finalScore,
      sBaseline: r.sBaseline,
      sImage: r.sImage,
      sText: r.sText,
      matchingFeatures: r.matchingFeatures,
      conflictingFeatures: r.conflictingFeatures,
      reason: r.reason,
      shortlisted: r.shortlisted,
    })),
    usedImageOnlyFallback,
    alphaEffective,
  });

  onProgress?.({ stage: 'Ranking complete', percent: 100 });

  const logEntry = buildLogEntry({
    config,
    alphaConfigured: alpha,
    alphaEffective,
    queryDescription: trimmedDesc,
    queryImageHash: processedQuery.imageHash,
    queryCategory,
    expectedItemId,
    testCaseTag,
    usedImageOnlyFallback,
    geminiCallsMade,
    ranked,
    items,
  });
  await saveSearchLog(logEntry);

  return {
    logEntry,
    rankedCandidates: ranked,
    usedImageOnlyFallback,
    alphaEffective,
    noStrongMatch: ranked.length > 0 && ranked[0].finalScore < 0.5,
    textOnlyEmptyDescription: false,
  };
}

function selectShortlist(
  items: FoundItem[],
  baselineMap: Map<string, number>,
  queryCategory: ItemCategory,
): FoundItem[] {
  if (items.length <= 20) {
    return items;
  }

  const scored = [...items].sort((a, b) => {
    const scoreA = (baselineMap.get(a.id) ?? 0) + (a.category === queryCategory ? 0.25 : 0);
    const scoreB = (baselineMap.get(b.id) ?? 0) + (b.category === queryCategory ? 0.25 : 0);
    return scoreB - scoreA;
  });

  const top20 = scored.slice(0, 20);
  const selectedIds = new Set(top20.map((i) => i.id));
  const result = [...top20];

  // Always include every item of the same category as the query
  for (const item of items) {
    if (item.category === queryCategory && !selectedIds.has(item.id)) {
      selectedIds.add(item.id);
      result.push(item);
    }
  }
  return result;
}

function countCategories(items: FoundItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }
  return counts;
}

function buildLogEntry(params: {
  config: MatchConfig;
  alphaConfigured: number;
  alphaEffective: number;
  queryDescription: string;
  queryImageHash: string;
  queryCategory?: string;
  expectedItemId?: string;
  testCaseTag?: TestCaseId | '';
  usedImageOnlyFallback: boolean;
  geminiCallsMade: number;
  ranked: RankedCandidate[];
  items: FoundItem[];
}): SearchLogEntry {
  return {
    id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    config: params.config,
    alphaConfigured: params.alphaConfigured,
    alphaEffective: params.alphaEffective,
    queryDescription: params.queryDescription,
    queryImageHash: params.queryImageHash,
    queryCategory: params.queryCategory,
    expectedItemId: params.expectedItemId?.trim() || undefined,
    testCaseTag: params.testCaseTag || undefined,
    usedImageOnlyFallback: params.usedImageOnlyFallback,
    geminiCallsMade: params.geminiCallsMade,
    rankedList: params.ranked.map((r) => ({
      rank: r.rank,
      itemId: r.itemId,
      category: r.item.category,
      finalScore: r.finalScore,
      sBaseline: r.sBaseline,
      sImage: r.sImage,
      sText: r.sText,
      reason: r.reason,
      matchingFeatures: r.matchingFeatures,
      conflictingFeatures: r.conflictingFeatures,
    })),
    databaseItemCount: params.items.length,
    databaseCategoryCounts: countCategories(params.items),
  };
}
