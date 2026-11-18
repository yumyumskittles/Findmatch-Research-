import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  PackageSearch,
} from 'lucide-react';
import type { FoundItem, SearchExecutionResult } from '../types';
import { formatScorePercent, getConfidenceLabel } from '../lib/similarity';

interface ResultsViewProps {
  searchResult: SearchExecutionResult | null;
  onRequestVerification: (item: FoundItem) => Promise<void>;
  onGoToSearch?: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  searchResult,
  onRequestVerification,
  onGoToSearch,
}) => {
  const [showAll, setShowAll] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  if (!searchResult) {
    return (
      <div className="bg-white rounded-[24px] p-10 text-center shadow-[0_14px_34px_rgba(60,70,120,0.08)]">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#F3EEFB] flex items-center justify-center text-[#6C5CE7]">
          <PackageSearch className="w-7 h-7" />
        </div>
        <h3 className="font-display text-2xl font-semibold text-[#111111]">
          No search results yet
        </h3>
        <p className="mt-2 text-[#6B6B80] max-w-md mx-auto text-[15px]">
          Upload a photo of your lost item on the Search page to rank candidate matches from the found-items database.
        </p>
        {onGoToSearch && (
          <button
            type="button"
            onClick={onGoToSearch}
            className="mt-6 px-6 py-3 rounded-[16px] bg-[#6C5CE7] text-white font-medium text-sm hover:bg-[#5B4BD6] transition-all cursor-pointer"
          >
            Go to Search
          </button>
        )}
      </div>
    );
  }

  if (searchResult.textOnlyEmptyDescription) {
    return (
      <div className="bg-[#FEF9E7] border border-[#F5C518]/40 rounded-[24px] p-6 flex items-start gap-3.5 text-[#333333]">
        <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[#111111]">Text-only needs a description</p>
          <p className="text-sm text-[#6B6B80] mt-1">
            Switch to Combined or Image-only mode, or enter a written description to rank items in Text-only mode.
          </p>
        </div>
      </div>
    );
  }

  const { rankedCandidates, usedImageOnlyFallback, noStrongMatch } = searchResult;
  const visibleCandidates = showAll ? rankedCandidates : rankedCandidates.slice(0, 5);

  const handleVerifyClick = async (item: FoundItem) => {
    setRequestingId(item.id);
    try {
      await onRequestVerification(item);
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <section aria-label="Ranked search results" className="space-y-5">
      {/* Header summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 text-xs font-bold tracking-[0.22em] uppercase text-[#6C5CE7]">
            <span className="w-2.5 h-2.5 bg-[#E53935] inline-block" aria-hidden="true" />
            <span>Ranked Candidates</span>
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-semibold text-[#111111] mt-1">
            {rankedCandidates.length} Found Item{rankedCandidates.length === 1 ? '' : 's'} Evaluated
          </h2>
        </div>

        <div className="text-sm text-[#6B6B80] font-mono-tabular">
          Config: <span className="text-[#111111] font-medium">{searchResult.logEntry.config}</span>
          {' · '}
          α = <span className="text-[#111111] font-medium">{searchResult.alphaEffective.toFixed(2)}</span>
        </div>
      </div>

      {/* Empty description note */}
      {usedImageOnlyFallback && (
        <div className="bg-white/85 rounded-[20px] px-5 py-3.5 flex items-center gap-3 text-sm text-[#333333] shadow-xs">
          <Info className="w-4 h-4 text-[#6C5CE7] shrink-0" />
          <span>No description given — ranked by image similarity only.</span>
        </div>
      )}

      {/* Low score banner */}
      {noStrongMatch && (
        <div
          role="status"
          className="bg-[#FFFBEB] border border-[#F5C518]/50 rounded-[24px] p-5 flex items-start gap-3.5 shadow-[0_10px_24px_rgba(245,197,24,0.12)]"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#F5C518]/20 flex items-center justify-center shrink-0 text-[#B45309]">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-[#111111] text-[15px]">
              No strong match found. Your item may not have been turned in yet. Check back later.
            </p>
            <p className="text-xs text-[#6B6B80] mt-1">
              Highest similarity score is below 50%. You can still review the closest visual candidates below.
            </p>
          </div>
        </div>
      )}

      {rankedCandidates.length === 0 ? (
        <div className="bg-white rounded-[24px] p-8 text-center text-[#6B6B80]">
          The found-items database is currently empty. Add items on the Register Item page or load sample data first.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visibleCandidates.map((cand) => {
            const pct = Math.round(cand.finalScore * 100);
            const confidence = getConfidenceLabel(cand.finalScore);
            const barColor =
              pct >= 75 ? 'bg-[#6C5CE7]' : pct >= 50 ? 'bg-[#F5C518]' : 'bg-[#94A3B8]';
            const isPending = cand.item.verificationStatus === 'pending_verification';

            return (
              <article
                key={cand.itemId}
                className="bg-white rounded-[24px] p-5 md:p-6 shadow-[0_14px_34px_rgba(60,70,120,0.08)] relative transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="flex flex-col md:flex-row gap-5">
                  {/* Thumbnail with top-left violet circle rank badge */}
                  <div className="relative w-full md:w-44 h-48 md:h-44 shrink-0 rounded-[18px] overflow-hidden bg-[#F3EEFB]">
                    <img
                      src={cand.item.imageDataUrl}
                      alt={`Found ${cand.item.category} ${cand.itemId}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div
                      className="absolute top-3 left-3 w-9 h-9 rounded-full bg-[#6C5CE7] text-white font-display font-bold text-sm flex items-center justify-center shadow-md font-mono-tabular"
                      aria-label={`Rank ${cand.rank}`}
                    >
                      #{cand.rank}
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6B80]">
                            <span className="font-mono-tabular font-semibold text-[#111111]">
                              {cand.itemId}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize font-medium text-[#333333]">
                              {cand.item.category}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{cand.item.locationFound}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">{cand.item.dateFound}</span>
                          </div>
                          <p className="mt-1.5 text-[15px] text-[#333333] leading-relaxed">
                            {cand.reason}
                          </p>
                        </div>

                        {/* Big percentage & confidence */}
                        <div className="text-left md:text-right shrink-0">
                          <div className="font-display text-3xl font-bold text-[#111111] font-mono-tabular leading-none">
                            {pct}%
                          </div>
                          <div className="text-xs font-medium text-[#6B6B80] mt-1">
                            {confidence}
                          </div>
                        </div>
                      </div>

                      {/* Thin rounded progress bar */}
                      <div className="mt-3 w-full h-2 bg-[#ECE6F8] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>

                      {/* Score breakdown */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-[#6B6B80] font-mono-tabular">
                        <span>
                          Image:{' '}
                          <strong className="text-[#111111]">
                            {cand.sImage !== null
                              ? formatScorePercent(cand.sImage)
                              : formatScorePercent(cand.sBaseline)}
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Text:{' '}
                          <strong className="text-[#111111]">
                            {formatScorePercent(cand.sText)}
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Baseline:{' '}
                          <strong className="text-[#111111]">
                            {formatScorePercent(cand.sBaseline)}
                          </strong>
                        </span>
                      </div>

                      {/* Matching (teal) and conflicting (pink) feature pills */}
                      {(cand.matchingFeatures.length > 0 ||
                        cand.conflictingFeatures.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {cand.matchingFeatures.map((feat, idx) => (
                            <span
                              key={`m-${idx}`}
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#2EC4B6]/15 text-[#0F766E]"
                            >
                              + {feat}
                            </span>
                          ))}
                          {cand.conflictingFeatures.map((feat, idx) => (
                            <span
                              key={`c-${idx}`}
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#F472B6]/18 text-[#9D174D]"
                            >
                              − {feat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer + Request Verification button */}
                    <div className="pt-3 border-t border-[#ECE6F8] flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-[#6B6B80]">
                        Possible match — verify in person with lost-and-found staff.
                      </p>

                      {isPending ? (
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[14px] bg-[#F3EEFB] text-[#6C5CE7] text-xs font-semibold whitespace-nowrap shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                          Pending verification
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={requestingId === cand.itemId}
                          onClick={() => handleVerifyClick(cand.item)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[14px] border border-[#6C5CE7] text-[#6C5CE7] text-xs font-semibold hover:bg-[#6C5CE7] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {requestingId === cand.itemId
                            ? 'Recording...'
                            : 'Request verification'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {rankedCandidates.length > 5 && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="px-6 py-3 rounded-[16px] bg-white text-[#6C5CE7] font-semibold text-sm shadow-sm hover:bg-[#F3EEFB] transition-colors cursor-pointer"
          >
            {showAll
              ? 'Show Top 5 only'
              : `Show all (${rankedCandidates.length} items)`}
          </button>
        </div>
      )}
    </section>
  );
};
