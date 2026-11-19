import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FolderPlus,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ITEM_CATEGORIES, type FoundItem, type ItemCategory } from '../types';
import {
  ImageValidationError,
  INVALID_IMAGE_ERROR,
  validateAndPreprocessImage,
  type ProcessedImageResult,
} from '../lib/imageProcessor';
import {
  indexFoundItemFromProcessed,
  registerFoundItem,
  reindexFoundItem,
} from '../lib/matcher';
import { deleteFoundItem } from '../lib/db';

interface RegisterPageProps {
  items: FoundItem[];
  onItemsChanged: () => Promise<void>;
  onLoadSampleData: () => Promise<void>;
  sampleLoadingText: string | null;
}

interface BulkDraftRow {
  localId: string;
  filename: string;
  processed: ProcessedImageResult;
  category: ItemCategory;
  locationFound: string;
  dateFound: string;
  description: string;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  items,
  onItemsChanged,
  onLoadSampleData,
  sampleLoadingText,
}) => {
  const singleInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);

  // Single-item state
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singlePreview, setSinglePreview] = useState<string | null>(null);
  const [category, setCategory] = useState<ItemCategory>('bottle');
  const [locationFound, setLocationFound] = useState('');
  const [dateFound, setDateFound] = useState(today);
  const [description, setDescription] = useState('');
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleSuccess, setSingleSuccess] = useState<string | null>(null);
  const [savingSingle, setSavingSingle] = useState(false);

  // Bulk-upload state
  const [bulkRows, setBulkRows] = useState<BulkDraftRow[]>([]);
  const [bulkLocationDefault, setBulkLocationDefault] = useState('Lost & Found Desk');
  const [bulkDateDefault, setBulkDateDefault] = useState(today);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);

  // List action state
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const handleSingleFileChange = async (file: File | null) => {
    setSingleError(null);
    setSingleSuccess(null);
    if (!file) return;

    try {
      const processed = await validateAndPreprocessImage(file);
      setSingleFile(file);
      setSinglePreview(processed.imageDataUrl);
    } catch (err) {
      setSingleFile(null);
      setSinglePreview(null);
      setSingleError(
        err instanceof ImageValidationError ? err.message : INVALID_IMAGE_ERROR,
      );
    }
  };

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleError(null);
    setSingleSuccess(null);

    if (!singleFile) {
      setSingleError(INVALID_IMAGE_ERROR);
      return;
    }

    setSavingSingle(true);
    try {
      const saved = await registerFoundItem({
        file: singleFile,
        category,
        description,
        locationFound,
        dateFound,
      });
      await onItemsChanged();
      setSingleSuccess(
        `Registered ${saved.id} (${saved.category}) with ${saved.visualProfile.distinctive_marks.length} extracted distinctive mark(s).`,
      );
      setSingleFile(null);
      setSinglePreview(null);
      setDescription('');
      setLocationFound('');
    } catch (err: unknown) {
      setSingleError(
        err instanceof Error ? err.message : 'Failed to register found item.',
      );
    } finally {
      setSavingSingle(false);
    }
  };

  const handleBulkSelect = async (files: FileList | null) => {
    setBulkError(null);
    if (!files || files.length === 0) return;

    const newRows: BulkDraftRow[] = [];
    let rejectedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const processed = await validateAndPreprocessImage(f);
        newRows.push({
          localId: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          filename: f.name,
          processed,
          category: 'other',
          locationFound: bulkLocationDefault,
          dateFound: bulkDateDefault,
          description: '',
        });
      } catch {
        rejectedCount++;
      }
    }

    if (rejectedCount > 0) {
      setBulkError(
        `${rejectedCount} file(s) skipped — ${INVALID_IMAGE_ERROR}`,
      );
    }
    setBulkRows((prev) => [...prev, ...newRows]);
  };

  const handleSaveBulk = async () => {
    if (bulkRows.length === 0) return;
    setBulkError(null);

    try {
      for (let i = 0; i < bulkRows.length; i++) {
        const row = bulkRows[i];
        setBulkProgress(`Precomputing features for ${row.filename} (${i + 1}/${bulkRows.length})...`);
        await indexFoundItemFromProcessed({
          processed: row.processed,
          category: row.category,
          description: row.description,
          locationFound: row.locationFound,
          dateFound: row.dateFound,
        });
      }
      setBulkRows([]);
      setBulkProgress(null);
      await onItemsChanged();
    } catch (err: unknown) {
      setBulkProgress(null);
      setBulkError(
        err instanceof Error ? err.message : 'Bulk registration encountered an error.',
      );
    }
  };

  const handleReindex = async (item: FoundItem) => {
    setListError(null);
    setReindexingId(item.id);
    try {
      await reindexFoundItem(item);
      await onItemsChanged();
    } catch (err: unknown) {
      setListError(
        err instanceof Error ? err.message : `Failed to re-index ${item.id}.`,
      );
    } finally {
      setReindexingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setListError(null);
    setDeletingId(id);
    try {
      await deleteFoundItem(id);
      await onItemsChanged();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-[#E53935] inline-block" aria-hidden="true" />
            <span className="text-[13px] font-bold tracking-[0.25em] uppercase text-[#6C5CE7]">
              Staff Intake
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-semibold text-[#111111] mt-2 tracking-tight">
            Register Found Item
          </h1>
          <p className="text-[16px] text-[#333333] mt-2 max-w-2xl">
            Add found belongings individually or in bulk. Photos are validated, normalized, and pre-indexed with visual features and embeddings for fast searches.
          </p>
        </div>

        <button
          type="button"
          onClick={onLoadSampleData}
          disabled={Boolean(sampleLoadingText)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-[16px] bg-white text-[#6C5CE7] text-sm font-semibold shadow-sm hover:bg-[#F3EEFB] transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          {sampleLoadingText ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{sampleLoadingText}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Load sample data</span>
            </>
          )}
        </button>
      </div>

      {/* Single Item Form */}
      <form
        onSubmit={handleSaveSingle}
        className="bg-white rounded-[24px] p-6 md:p-9 shadow-[0_18px_40px_rgba(60,70,120,0.08)] space-y-6"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold text-[#111111]">
            Single Item Registration
          </h2>
          <span className="text-xs text-[#6B6B80]">
            Avoid including faces, IDs or personal documents in the photo.
          </span>
        </div>

        <div className="grid grid-cols-1 min-[900px]:grid-cols-12 gap-6">
          {/* Photo Picker */}
          <div className="min-[900px]:col-span-5 flex flex-col">
            <label
              htmlFor="register-single-photo"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleSingleFileChange(e.dataTransfer.files?.[0] || null);
              }}
              className="flex-1 min-h-[220px] rounded-[20px] border-2 border-dashed border-[#6C5CE7]/40 bg-[#FAF8FE] hover:border-[#6C5CE7] transition-colors flex flex-col items-center justify-center p-5 text-center cursor-pointer"
            >
              <input
                id="register-single-photo"
                ref={singleInputRef}
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={(e) => {
                  void handleSingleFileChange(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />

              {singlePreview ? (
                <div className="space-y-2.5">
                  <img
                    src={singlePreview}
                    alt="Found item preview"
                    referrerPolicy="no-referrer"
                    className="max-h-44 mx-auto rounded-2xl object-contain shadow-sm"
                  />
                  <p className="text-xs text-[#6B6B80]">
                    {singleFile?.name} · Click to change
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-[#ECE6F8] text-[#6C5CE7] flex items-center justify-center mb-3">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                  <p className="font-medium text-[#111111] text-sm">
                    Select Found Item Photo (Required)
                  </p>
                  <p className="text-xs text-[#6B6B80] mt-1">JPG / JPEG or PNG</p>
                </>
              )}
            </label>

            {singleError && (
              <div
                role="alert"
                className="mt-3 rounded-[14px] bg-[#FEF2F2] border border-[#E53935]/30 px-4 py-2.5 flex items-center gap-2 text-xs font-medium text-[#B91C1C]"
              >
                <AlertCircle className="w-4 h-4 text-[#E53935] shrink-0" />
                <span>{singleError}</span>
              </div>
            )}
          </div>

          {/* Metadata Fields */}
          <div className="min-[900px]:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="reg-category"
                  className="block text-xs font-semibold text-[#333333] mb-1.5"
                >
                  Category
                </label>
                <select
                  id="reg-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ItemCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DAF5] bg-[#FAF8FE] text-sm text-[#111111] focus:outline-none focus:border-[#6C5CE7]"
                >
                  {ITEM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="reg-location"
                  className="block text-xs font-semibold text-[#333333] mb-1.5"
                >
                  Location Found
                </label>
                <input
                  id="reg-location"
                  type="text"
                  value={locationFound}
                  onChange={(e) => setLocationFound(e.target.value)}
                  placeholder="e.g. Library 2nd Floor"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DAF5] bg-[#FAF8FE] text-sm text-[#111111] focus:outline-none focus:border-[#6C5CE7]"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-date"
                  className="block text-xs font-semibold text-[#333333] mb-1.5"
                >
                  Date Found
                </label>
                <input
                  id="reg-date"
                  type="date"
                  value={dateFound}
                  onChange={(e) => setDateFound(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2DAF5] bg-[#FAF8FE] text-sm text-[#111111] focus:outline-none focus:border-[#6C5CE7]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-description"
                className="block text-xs font-semibold text-[#333333] mb-1.5"
              >
                Written Description <span className="font-normal text-[#6B6B80]">(optional)</span>
              </label>
              <textarea
                id="reg-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Note distinctive details like stickers, scratches, initials, brand, or wear..."
                className="w-full px-4 py-3 rounded-xl border border-[#E2DAF5] bg-[#FAF8FE] text-sm text-[#111111] focus:outline-none focus:border-[#6C5CE7] resize-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {singleSuccess ? (
                <div className="inline-flex items-center gap-2 text-xs font-medium text-[#0F766E]">
                  <CheckCircle2 className="w-4 h-4 text-[#2EC4B6]" />
                  <span>{singleSuccess}</span>
                </div>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={savingSingle}
                className="bg-[#6C5CE7] text-white font-medium text-sm rounded-[16px] px-7 py-3.5 shadow-[0_10px_24px_rgba(108,92,231,0.28)] hover:bg-[#5D4CE0] transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {savingSingle ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Precomputing features...</span>
                  </>
                ) : (
                  <span>Save Found Item</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Bulk Upload Card */}
      <div className="bg-white rounded-[24px] p-6 md:p-9 shadow-[0_18px_40px_rgba(60,70,120,0.08)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#111111]">
              Bulk Photo Upload
            </h2>
            <p className="text-xs text-[#6B6B80] mt-1">
              Select multiple JPG/PNG photos at once and enter a description for each item before indexing.
            </p>
          </div>

          <div>
            <input
              id="register-bulk-photos"
              ref={bulkInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={(e) => {
                void handleBulkSelect(e.target.files);
                e.target.value = '';
              }}
            />
            <label
              htmlFor="register-bulk-photos"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[14px] border border-[#6C5CE7] text-[#6C5CE7] text-sm font-semibold hover:bg-[#6C5CE7] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Select Multiple Photos</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#333333] mb-1">
              Default Location for Batch
            </label>
            <input
              type="text"
              value={bulkLocationDefault}
              onChange={(e) => setBulkLocationDefault(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E2DAF5] bg-[#FAF8FE] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#333333] mb-1">
              Default Date for Batch
            </label>
            <input
              type="date"
              value={bulkDateDefault}
              onChange={(e) => setBulkDateDefault(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E2DAF5] bg-[#FAF8FE] text-sm"
            />
          </div>
        </div>

        {bulkError && (
          <div
            role="alert"
            className="rounded-[14px] bg-[#FEF2F2] border border-[#E53935]/30 px-4 py-2.5 flex items-center gap-2 text-xs font-medium text-[#B91C1C]"
          >
            <AlertCircle className="w-4 h-4 text-[#E53935] shrink-0" />
            <span>{bulkError}</span>
          </div>
        )}

        {bulkRows.length > 0 && (
          <div className="space-y-4">
            <div className="divide-y divide-[#ECE6F8] border border-[#ECE6F8] rounded-[18px] overflow-hidden">
              {bulkRows.map((row) => (
                <div
                  key={row.localId}
                  className="p-4 bg-[#FAF8FE]/50 flex flex-col md:flex-row items-start md:items-center gap-4"
                >
                  <img
                    src={row.processed.imageDataUrl}
                    alt={row.filename}
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-xl object-cover shrink-0 bg-white"
                  />

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-3 w-full">
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-[#6B6B80] mb-1">
                        Category
                      </label>
                      <select
                        value={row.category}
                        onChange={(e) =>
                          setBulkRows((prev) =>
                            prev.map((r) =>
                              r.localId === row.localId
                                ? { ...r, category: e.target.value as ItemCategory }
                                : r,
                            ),
                          )
                        }
                        className="w-full px-2.5 py-2 rounded-xl border border-[#E2DAF5] bg-white text-xs"
                      >
                        {ITEM_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-[#6B6B80] mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={row.locationFound}
                        onChange={(e) =>
                          setBulkRows((prev) =>
                            prev.map((r) =>
                              r.localId === row.localId
                                ? { ...r, locationFound: e.target.value }
                                : r,
                            ),
                          )
                        }
                        className="w-full px-2.5 py-2 rounded-xl border border-[#E2DAF5] bg-white text-xs"
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-semibold text-[#6B6B80] mb-1">
                        Description ({row.filename})
                      </label>
                      <input
                        type="text"
                        value={row.description}
                        placeholder="Describe stickers, scratches, logos..."
                        onChange={(e) =>
                          setBulkRows((prev) =>
                            prev.map((r) =>
                              r.localId === row.localId
                                ? { ...r, description: e.target.value }
                                : r,
                            ),
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E2DAF5] bg-white text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setBulkRows((prev) =>
                        prev.filter((r) => r.localId !== row.localId),
                      )
                    }
                    aria-label={`Remove ${row.filename} from batch`}
                    className="p-2 text-[#6B6B80] hover:text-[#E53935] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#6B6B80]">
                {bulkProgress || `${bulkRows.length} photo(s) ready to index`}
              </span>
              <button
                type="button"
                disabled={Boolean(bulkProgress)}
                onClick={handleSaveBulk}
                className="bg-[#6C5CE7] text-white font-medium text-sm rounded-[16px] px-6 py-3 hover:bg-[#5D4CE0] transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {bulkProgress ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Indexing batch...</span>
                  </>
                ) : (
                  <span>Save All ({bulkRows.length})</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stored Found Items Thumbnail List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-[#111111]">
            Indexed Found Items ({items.length})
          </h2>
        </div>

        {listError && (
          <div
            role="alert"
            className="rounded-[16px] bg-[#FEF2F2] border border-[#E53935]/30 px-4 py-3 text-sm text-[#B91C1C]"
          >
            {listError}
          </div>
        )}

        {items.length === 0 ? (
          <div className="bg-white rounded-[24px] p-10 text-center text-[#6B6B80]">
            No found items registered yet. Use the form above or click &ldquo;Load sample data&rdquo; to populate starter test items.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <article
                key={item.id}
                className="bg-white rounded-[24px] p-4 shadow-[0_12px_28px_rgba(60,70,120,0.07)] flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="relative h-44 rounded-[16px] overflow-hidden bg-[#F3EEFB]">
                    <img
                      src={item.imageDataUrl}
                      alt={`${item.category} ${item.id}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-[#111111]/80 text-white text-xs font-mono-tabular font-semibold">
                      {item.id}
                    </span>
                    {item.verificationStatus === 'pending_verification' && (
                      <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-[#F5C518] text-[#111111] text-[11px] font-semibold">
                        Pending verification
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-[#6B6B80]">
                      <span className="capitalize font-semibold text-[#111111]">
                        {item.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{item.locationFound}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular shrink-0">{item.dateFound}</span>
                    </div>

                    <p className="text-xs text-[#333333] line-clamp-2 leading-relaxed">
                      {item.description || item.visualProfile.caption}
                    </p>

                    <p className="text-[11px] text-[#6B6B80] font-mono-tabular">
                      {item.visualProfile.distinctive_marks.length} mark(s) extracted ·{' '}
                      {item.textEmbedding.length}d embedding
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#ECE6F8] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={reindexingId === item.id}
                    onClick={() => handleReindex(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#6C5CE7] hover:bg-[#F3EEFB] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        reindexingId === item.id ? 'animate-spin' : ''
                      }`}
                    />
                    <span>{reindexingId === item.id ? 'Re-indexing...' : 'Re-index'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#E53935] hover:bg-[#FEF2F2] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
