export type PageId = 'search' | 'register' | 'results' | 'evaluation' | 'about';

export type ItemCategory =
  | 'bottle'
  | 'umbrella'
  | 'bag'
  | 'charger'
  | 'ID holder'
  | 'other';

export const ITEM_CATEGORIES: ItemCategory[] = [
  'bottle',
  'umbrella',
  'bag',
  'charger',
  'ID holder',
  'other',
];

export type MarkType =
  | 'sticker'
  | 'scratch'
  | 'dent'
  | 'logo'
  | 'label'
  | 'pattern'
  | 'writing'
  | 'wear'
  | 'other';

export interface DistinctiveMark {
  type: MarkType | string;
  description: string;
  location_on_item: string;
}

export interface VisualProfile {
  category: string;
  main_colors: string[];
  brand_or_logo: string | null;
  shape_material: string;
  distinctive_marks: DistinctiveMark[];
  caption: string;
}

export interface BaselineFeatures {
  hsvHistogram: number[]; // 128 normalized bins (8 x 4 x 4)
  dHashHex: string; // 16 hex chars (64 bits)
}

export interface FoundItem {
  id: string; // e.g., FI-001
  imageDataUrl: string; // preprocessed JPEG quality 0.9, longest side <= 1024px
  imageHash: string; // SHA-256 hex of preprocessed JPEG
  category: ItemCategory;
  description: string;
  locationFound: string;
  dateFound: string;
  createdAt: string;
  updatedAt: string;
  baselineFeatures: BaselineFeatures;
  visualProfile: VisualProfile;
  textEmbedding: number[];
  verificationStatus: 'available' | 'pending_verification';
  verificationRequestedAt?: string;
}

export type MatchConfig = 'baseline' | 'image-only' | 'text-only' | 'combined';

export interface RankedCandidate {
  itemId: string;
  item: FoundItem;
  rank: number;
  finalScore: number; // 0.0 - 1.0
  sBaseline: number; // 0.0 - 1.0
  sImage: number | null; // 0.0 - 1.0 (null in baseline or text-only if omitted)
  sText: number | null; // 0.0 - 1.0 (null when description is empty or baseline/image-only)
  matchingFeatures: string[];
  conflictingFeatures: string[];
  reason: string;
  shortlisted: boolean;
}

export type TestCaseId = 'TC-01' | 'TC-02' | 'TC-03' | 'TC-04' | 'TC-05';

export interface SearchLogEntry {
  id: string;
  timestamp: string;
  config: MatchConfig;
  alphaConfigured: number;
  alphaEffective: number;
  queryDescription: string;
  queryImageHash: string;
  queryCategory?: string;
  expectedItemId?: string;
  testCaseTag?: TestCaseId | '';
  usedImageOnlyFallback: boolean;
  validationError?: string;
  geminiCallsMade: number;
  rankedList: Array<{
    rank: number;
    itemId: string;
    category: string;
    finalScore: number;
    sBaseline: number;
    sImage: number | null;
    sText: number | null;
    reason: string;
    matchingFeatures: string[];
    conflictingFeatures: string[];
  }>;
  databaseItemCount: number;
  databaseCategoryCounts: Record<string, number>;
}

export interface SearchExecutionResult {
  logEntry: SearchLogEntry;
  rankedCandidates: RankedCandidate[];
  usedImageOnlyFallback: boolean;
  alphaEffective: number;
  noStrongMatch: boolean;
  textOnlyEmptyDescription: boolean;
}

export interface TestCaseCheckResult {
  testCaseId: TestCaseId;
  title: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'NOT TESTED';
  matchedLogId?: string;
  checks: Array<{
    label: string;
    passed: boolean;
    detail: string;
  }>;
}
