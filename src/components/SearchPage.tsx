import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Database,
  ImagePlus,
  Loader2,
  Mouse,
  Sparkles,
  Upload,
} from 'lucide-react';
import type {
  FoundItem,
  MatchConfig,
  SearchExecutionResult,
  TestCaseId,
} from '../types';
import {
  ImageValidationError,
  INVALID_IMAGE_ERROR,
  validateAndPreprocessImage,
  type ProcessedImageResult,
} from '../lib/imageProcessor';
import { executeLostItemSearch, type SearchProgressUpdate } from '../lib/matcher';
import { saveSearchLog } from '../lib/db';
import { HeroIllustration } from './HeroIllustration';
import { ResultsView } from './ResultsView';

interface SearchPageProps {
  items: FoundItem[];
  matchConfig: MatchConfig;
  alpha: number;
  expectedItemId: string;
  testCaseTag: TestCaseId | '';
  onExpectedItemIdChange: (val: string) => void;
  onTestCaseTagChange: (val: TestCaseId | '') => void;
  latestResult: SearchExecutionResult | null;
  onSearchCompleted: (result: SearchExecutionResult) => void;
  onLogRecorded: () => Promise<void>;
  onRequestVerification: (item: FoundItem) => Promise<void>;
  onLoadSampleData: () => Promise<void>;
  sampleLoadingText: string | null;
}

const HOW_IT_WORKS_SLIDES = [
  {
    step: '01',
    title: 'Upload photo',
    detail: 'Drop a JPG or PNG of your lost item — no faces or IDs needed.',
  },
  {
    step: '02',
    title: 'Describe marks',
    detail: 'Note stickers, scratches, logos, or wear that set yours apart.',
  },
  {
    step: '03',
    title: 'Get ranked matches',
    detail: 'Visual and text similarity rank even near-identical items.',
  },
  {
    step: '04',
    title: 'Verify in person',
    detail: 'Request verification and confirm ownership with lost-and-found staff.',
  },
];

export const SearchPage: React.FC<SearchPageProps> = ({
  items,
  matchConfig,
  alpha,
  expectedItemId,
  testCaseTag,
  onExpectedItemIdChange,
  onTestCaseTagChange,
  latestResult,
  onSearchCompleted,
  onLogRecorded,
  onRequestVerification,
  onLoadSampleData,
  sampleLoadingText,
}) => {
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [slideIdx, setSlideIdx] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedQuery, setProcessedQuery] = useState<ProcessedImageResult | null>(null);
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState<SearchProgressUpdate | null>(null);
  const [localResult, setLocalResult] = useState<SearchExecutionResult | null>(latestResult);
  const [showEvalFields, setShowEvalFields] = useState(false);

  const activeSlide = HOW_IT_WORKS_SLIDES[slideIdx];

  const scrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileSelection = async (file: File | null) => {
    setApiError(null);
    if (!file) return;

    try {
      const processed = await validateAndPreprocessImage(file);
      setValidationError(null);
      setSelectedFile(file);
      setPreviewUrl(processed.imageDataUrl);
      setProcessedQuery(processed);
    } catch (err) {
      const msg =
        err instanceof ImageValidationError ? err.message : INVALID_IMAGE_ERROR;
      // Clear any previous preview & results per spec
      setSelectedFile(null);
      setPreviewUrl(null);
      setProcessedQuery(null);
      setLocalResult(null);
      setValidationError(msg);

      // Record rejected validation event in log for TC-05 auto-check visibility
      await saveSearchLog({
        id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        config: matchConfig,
        alphaConfigured: alpha,
        alphaEffective: 0,
        queryDescription: description.trim(),
        queryImageHash: 'invalid-input',
        expectedItemId: expectedItemId.trim() || undefined,
        testCaseTag: testCaseTag || undefined,
        usedImageOnlyFallback: false,
        validationError: INVALID_IMAGE_ERROR,
        geminiCallsMade: 0,
        rankedList: [],
        databaseItemCount: items.length,
        databaseCategoryCounts: {},
      });
      await onLogRecorded();
    }
  };

  const handleRunSearch = async () => {
    setApiError(null);

    // Re-validate if a file was selected or prompt if no photo yet
    if (!selectedFile || !processedQuery) {
      setLocalResult(null);
      setValidationError(INVALID_IMAGE_ERROR);
      scrollToUpload();
      return;
    }

    if (items.length === 0) {
      setApiError(
        'No found items are currently in the database. Register an item or click "Load sample data" first.',
      );
      return;
    }

    setSearching(true);
    setProgress({ stage: 'Starting search pipeline...', percent: 5 });

    try {
      const result = await executeLostItemSearch({
        processedQuery,
        queryDescription: description,
        items,
        config: matchConfig,
        alpha,
        expectedItemId,
        testCaseTag,
        onProgress: (p) => setProgress(p),
      });

      setLocalResult(result);
      onSearchCompleted(result);
      await onLogRecorded();
    } catch (err: unknown) {
      // Never show partial rankings on API failure
      setLocalResult(null);
      const message =
        err instanceof Error ? err.message : 'Matching failed due to an API error.';
      setApiError(`Could not complete matching: ${message}`);
    } finally {
      setSearching(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-14">
      {/* Two-Column Hero */}
      <section className="grid grid-cols-1 min-[900px]:grid-cols-12 items-center gap-10">
        <div className="min-[900px]:col-span-6 space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-[#E53935] inline-block shrink-0" aria-hidden="true" />
            <span className="text-[14px] font-bold tracking-[0.25em] uppercase text-[#6C5CE7]">
              Lost &amp; Found Matching
            </span>
          </div>

          <h1 className="font-display font-semibold text-[#111111] text-[40px] min-[900px]:text-[66px] leading-[1.08] tracking-tight text-balance">
            Find Your
            <br />
            Lost Item.
          </h1>

          <p className="text-[17px] leading-relaxed text-[#333333] max-w-[420px]">
            Upload a photo and describe your item. We&apos;ll compare it against every found item and rank the closest matches — even ones that look nearly identical.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              type="button"
              onClick={processedQuery ? handleRunSearch : scrollToUpload}
              disabled={searching}
              className="bg-[#6C5CE7] text-white font-medium text-[16px] rounded-[16px] px-[34px] py-[18px] shadow-[0_14px_28px_rgba(108,92,231,0.34)] hover:-translate-y-0.5 hover:bg-[#5D4CE0] transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              {searching ? 'Matching...' : 'Find Matches'}
            </button>

            <div className="text-sm text-[#6B6B80] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#6C5CE7]" />
              <span>
                <strong className="text-[#111111] font-mono-tabular">{items.length}</strong> found item{items.length === 1 ? '' : 's'} in database
              </span>
            </div>
          </div>
        </div>

        <div className="min-[900px]:col-span-6">
          <HeroIllustration />
        </div>
      </section>

      {/* Bottom Slider Footer Bar */}
      <div className="pt-4 border-t border-[#6C5CE7]/12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={scrollToUpload}
          className="inline-flex items-center gap-2.5 text-xs tracking-[0.22em] uppercase text-[#6B6B80] hover:text-[#111111] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Mouse className="w-4 h-4" />
          <span>Explore Now</span>
        </button>

        <div className="text-sm text-[#333333] flex items-center gap-2">
          <span className="font-bold text-[#111111]">How It Works</span>
          <span aria-hidden="true" className="text-[#6B6B80]">·</span>
          <span className="text-[#6B6B80]">
            <strong className="text-[#111111] font-medium">{activeSlide.title}:</strong>{' '}
            {activeSlide.detail}
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setSlideIdx((prev) =>
                  prev === 0 ? HOW_IT_WORKS_SLIDES.length - 1 : prev - 1,
                )
              }
              aria-label="Previous step"
              className="w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#111111] flex items-center justify-center shadow-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setSlideIdx((prev) => (prev + 1) % HOW_IT_WORKS_SLIDES.length)
              }
              aria-label="Next step"
              className="w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#111111] flex items-center justify-center shadow-xs transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-sm font-mono-tabular">
            <span className="font-bold text-[#111111]">{activeSlide.step}</span>
            <span className="text-[#6B6B80]"> . 04</span>
          </div>
        </div>
      </div>

      {/* Upload & Search Card */}
      <div
        ref={uploadSectionRef}
        className="bg-white rounded-[24px] p-6 md:p-10 shadow-[0_18px_40px_rgba(60,70,120,0.08)] space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#111111]">
              Search for Your Lost Item
            </h2>
            <p className="text-sm text-[#6B6B80] mt-1">
              Avoid including faces, IDs or personal documents in the photo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onLoadSampleData}
              disabled={Boolean(sampleLoadingText)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[14px] bg-[#F3EEFB] text-[#6C5CE7] text-xs font-semibold hover:bg-[#E7DDF9] transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              {sampleLoadingText ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{sampleLoadingText}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load sample data</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowEvalFields((v) => !v)}
              className="px-3.5 py-2.5 rounded-[14px] text-xs font-medium text-[#6B6B80] hover:text-[#111111] hover:bg-[#F8F6FC] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {showEvalFields ? 'Hide test tagging' : 'Tag for evaluation'}
            </button>
          </div>
        </div>

        {/* Optional Researcher Test Tagging Strip */}
        {showEvalFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[#F8F6FC]">
            <div>
              <label
                htmlFor="search-expected-id"
                className="block text-xs font-semibold text-[#333333] mb-1.5"
              >
                Expected Item ID (optional, for evaluation)
              </label>
              <input
                id="search-expected-id"
                type="text"
                placeholder="e.g. FI-001"
                value={expectedItemId}
                onChange={(e) => onExpectedItemIdChange(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E2DAF5] text-sm text-[#111111] focus:outline-none focus:border-[#6C5CE7]"
              />
            </div>

            <div>
              <label
                htmlFor="search-tc-tag"
                className="block text-xs font-semibold text-[#333333] mb-1.5"
              >
                Acceptance Test Case Tag (optional)
              </label>
              <select
                id="search-tc-tag"
                value={testCaseTag}
                onChange={(e) => onTestCaseTagChange(e.target.value as TestCaseId | '')}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E2DAF5] text-sm text-[#111111] focus:outline-none focus:border-[#6C5CE7]"
              >
                <option value="">None</option>
                <option value="TC-01">TC-01 — Valid photo + description</option>
                <option value="TC-02">TC-02 — Near-identical items</option>
                <option value="TC-03">TC-03 — Photo only, no description</option>
                <option value="TC-04">TC-04 — Item not in database</option>
                <option value="TC-05">TC-05 — Unsupported / corrupted file</option>
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 min-[900px]:grid-cols-12 gap-6 items-stretch">
          {/* Drag-and-drop Zone */}
          <div className="min-[900px]:col-span-6 flex flex-col">
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const dropped = e.dataTransfer.files?.[0] || null;
                void handleFileSelection(dropped);
              }}
              className={`flex-1 min-h-[220px] rounded-[20px] border-2 border-dashed transition-colors flex flex-col items-center justify-center p-6 text-center cursor-pointer ${
                dragActive
                  ? 'border-[#6C5CE7] bg-[#F3EEFB]'
                  : 'border-[#6C5CE7]/40 bg-[#FAF8FE] hover:border-[#6C5CE7]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  void handleFileSelection(file);
                  e.target.value = '';
                }}
              />

              {previewUrl ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <img
                    src={previewUrl}
                    alt="Uploaded lost item preview"
                    referrerPolicy="no-referrer"
                    className="max-h-44 w-auto rounded-2xl object-contain shadow-sm"
                  />
                  <div className="text-xs text-[#6B6B80]">
                    <span className="font-medium text-[#111111]">
                      {selectedFile?.name}
                    </span>
                    {' · '}
                    <span>Click or drop another JPG/PNG to replace</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-[#ECE6F8] text-[#6C5CE7] flex items-center justify-center mb-3">
                    <ImagePlus className="w-7 h-7" />
                  </div>
                  <p className="font-medium text-[#111111] text-[15px]">
                    Drag &amp; drop a photo here, or click to browse
                  </p>
                  <p className="text-xs text-[#6B6B80] mt-1.5">
                    Accepts JPG / JPEG and PNG only
                  </p>
                </>
              )}
            </div>

            {/* Soft red validation alert under upload zone */}
            {validationError && (
              <div
                role="alert"
                className="mt-3 rounded-[16px] bg-[#FEF2F2] border border-[#E53935]/30 px-4 py-3 flex items-center gap-2.5 text-sm font-medium text-[#B91C1C]"
              >
                <AlertCircle className="w-4 h-4 text-[#E53935] shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* Description + Find Matches CTA */}
          <div className="min-[900px]:col-span-6 flex flex-col justify-between gap-4">
            <div className="flex-1 flex flex-col">
              <label
                htmlFor="lost-description"
                className="block text-sm font-semibold text-[#111111] mb-2"
              >
                Written Description <span className="font-normal text-[#6B6B80]">(optional)</span>
              </label>
              <textarea
                id="lost-description"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe small details like stickers, scratches, brand logos, keychains, or labels (e.g., 'matte black bottle, gold star sticker near the middle'). Leave blank for photo-only search."
                className="flex-1 w-full rounded-[18px] border border-[#E2DAF5] bg-[#FAF8FE] p-4 text-[15px] text-[#111111] placeholder:text-[#6B6B80]/70 focus:outline-none focus:border-[#6C5CE7] focus:bg-white transition-colors resize-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-[#6B6B80]">
                Mode:{' '}
                <strong className="text-[#111111]">{matchConfig}</strong>
                {matchConfig === 'combined' && (
                  <span> · α = {alpha.toFixed(2)}</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleRunSearch}
                disabled={searching}
                className="inline-flex items-center gap-2.5 bg-[#6C5CE7] text-white font-medium text-[16px] rounded-[16px] px-[34px] py-[16px] shadow-[0_12px_26px_rgba(108,92,231,0.3)] hover:-translate-y-0.5 hover:bg-[#5D4CE0] transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                {searching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Matching...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Find Matches</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Progress state */}
        {searching && progress && (
          <div className="rounded-[18px] bg-[#F3EEFB] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-[#333333]">
              <span>{progress.stage}</span>
              <span className="font-mono-tabular">{progress.percent}%</span>
            </div>
            <div className="w-full h-2 bg-white rounded-full overflow-hidden">
              <div
                className="h-full bg-[#6C5CE7] rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Friendly API error (never shows partial rankings) */}
        {apiError && (
          <div
            role="alert"
            className="rounded-[18px] bg-[#FEF2F2] border border-[#E53935]/30 p-4 flex items-start gap-3 text-sm text-[#B91C1C]"
          >
            <AlertCircle className="w-5 h-5 text-[#E53935] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to complete matching</p>
              <p className="mt-0.5">{apiError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Results area (only shown when we have a search result and no validation error) */}
      {!validationError && !apiError && localResult && (
        <ResultsView
          searchResult={localResult}
          onRequestVerification={onRequestVerification}
        />
      )}
    </div>
  );
};
