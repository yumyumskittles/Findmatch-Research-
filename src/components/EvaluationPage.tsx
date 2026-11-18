import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  MinusCircle,
  Trash2,
  XCircle,
} from 'lucide-react';
import type {
  MatchConfig,
  SearchLogEntry,
  TestCaseId,
} from '../types';
import {
  computeAggregateMetrics,
  computeLogMetrics,
  evaluateTestCases,
  exportLogsAsCsv,
  exportLogsAsJson,
} from '../lib/testCases';
import { formatScorePercent } from '../lib/similarity';

interface EvaluationPageProps {
  matchConfig: MatchConfig;
  alpha: number;
  onConfigChange: (cfg: MatchConfig) => void;
  onAlphaChange: (val: number) => void;
  logs: SearchLogEntry[];
  onUpdateLogEntry: (updated: SearchLogEntry) => Promise<void>;
  onClearLogs: () => Promise<void>;
}

const CONFIG_OPTIONS: Array<{ value: MatchConfig; label: string }> = [
  { value: 'combined', label: 'Combined image-text (default)' },
  { value: 'baseline', label: 'Baseline image similarity' },
  { value: 'image-only', label: 'Image-only' },
  { value: 'text-only', label: 'Text-only' },
];

export const EvaluationPage: React.FC<EvaluationPageProps> = ({
  matchConfig,
  alpha,
  onConfigChange,
  onAlphaChange,
  logs,
  onUpdateLogEntry,
  onClearLogs,
}) => {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const aggregate = computeAggregateMetrics(logs);
  const testCases = evaluateTestCases(logs);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-[#E53935] inline-block" aria-hidden="true" />
            <span className="text-[13px] font-bold tracking-[0.25em] uppercase text-[#6C5CE7]">
              Developer Panel
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-semibold text-[#111111] mt-2 tracking-tight">
            Test &amp; Evaluation
          </h1>
          <p className="text-[16px] text-[#333333] mt-2 max-w-2xl">
            Configure matching weights, inspect logged search rankings, track retrieval accuracy, and verify acceptance test cases TC-01 through TC-05.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={logs.length === 0}
            onClick={() => exportLogsAsCsv(logs)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[14px] bg-white text-[#111111] text-xs font-semibold shadow-xs hover:bg-[#F3EEFB] transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-[#6C5CE7]" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            disabled={logs.length === 0}
            onClick={() => exportLogsAsJson(logs)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[14px] bg-white text-[#111111] text-xs font-semibold shadow-xs hover:bg-[#F3EEFB] transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-[#6C5CE7]" />
            <span>Export JSON</span>
          </button>

          {logs.length > 0 && (
            <button
              type="button"
              onClick={onClearLogs}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[14px] text-xs font-semibold text-[#E53935] hover:bg-[#FEF2F2] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear log</span>
            </button>
          )}
        </div>
      </div>

      {/* Configuration & Running Accuracy Metrics */}
      <div className="grid grid-cols-1 min-[900px]:grid-cols-12 gap-6">
        <div className="min-[900px]:col-span-6 bg-white rounded-[24px] p-6 shadow-[0_14px_34px_rgba(60,70,120,0.08)] space-y-5">
          <h2 className="font-display text-lg font-semibold text-[#111111]">
            Active Matching Configuration
          </h2>

          <div>
            <label
              htmlFor="eval-config"
              className="block text-xs font-semibold text-[#333333] mb-1.5"
            >
              Matching Mode
            </label>
            <select
              id="eval-config"
              value={matchConfig}
              onChange={(e) => onConfigChange(e.target.value as MatchConfig)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2DAF5] bg-[#FAF8FE] text-sm text-[#111111] focus:outline-none focus:border-[#6C5CE7]"
            >
              {CONFIG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[#333333] mb-1.5">
              <label htmlFor="eval-alpha">α (Image Weight)</label>
              <span className="font-mono-tabular text-[#6C5CE7]">
                α = {alpha.toFixed(2)} · Text = {(1 - alpha).toFixed(2)}
              </span>
            </div>
            <input
              id="eval-alpha"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={alpha}
              onChange={(e) => onAlphaChange(Number(e.target.value))}
              className="w-full accent-[#6C5CE7] cursor-pointer"
            />
            <p className="text-[11px] text-[#6B6B80] mt-1">
              Applies to Combined mode (`α * S_image + (1 - α) * S_text`). Empty descriptions automatically force α = 1.0.
            </p>
          </div>
        </div>

        {/* Running Metrics */}
        <div className="min-[900px]:col-span-6 bg-white rounded-[24px] p-6 shadow-[0_14px_34px_rgba(60,70,120,0.08)] flex flex-col justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#111111]">
              Running Retrieval Metrics
            </h2>
            <p className="text-xs text-[#6B6B80] mt-1">
              Computed across {aggregate.evaluatedCount} logged search(es) with an Expected Item ID specified.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            <div className="p-4 rounded-2xl bg-[#FAF8FE]">
              <div className="text-[11px] font-medium text-[#6B6B80]">Top-1 Accuracy</div>
              <div className="font-display text-2xl font-bold text-[#111111] font-mono-tabular mt-1">
                {aggregate.evaluatedCount > 0
                  ? `${Math.round(aggregate.top1Accuracy * 100)}%`
                  : '—'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF8FE]">
              <div className="text-[11px] font-medium text-[#6B6B80]">Top-5 Accuracy</div>
              <div className="font-display text-2xl font-bold text-[#111111] font-mono-tabular mt-1">
                {aggregate.evaluatedCount > 0
                  ? `${Math.round(aggregate.top5Accuracy * 100)}%`
                  : '—'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF8FE]">
              <div className="text-[11px] font-medium text-[#6B6B80]">MRR</div>
              <div className="font-display text-2xl font-bold text-[#6C5CE7] font-mono-tabular mt-1">
                {aggregate.evaluatedCount > 0 ? aggregate.mrr.toFixed(3) : '—'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF8FE]">
              <div className="text-[11px] font-medium text-[#6B6B80]">Total Logged</div>
              <div className="font-display text-2xl font-bold text-[#111111] font-mono-tabular mt-1">
                {logs.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Acceptance Test Case Checklist (TC-01 to TC-05) */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-[#111111]">
          Test Case Checklist (TC-01 to TC-05)
        </h2>

        <div className="bg-white rounded-[24px] overflow-hidden shadow-[0_14px_34px_rgba(60,70,120,0.08)]">
          <div className="divide-y divide-[#ECE6F8]">
            {testCases.map((tc, idx) => (
              <div
                key={tc.testCaseId}
                className={`p-5 ${idx % 2 === 1 ? 'bg-[#FAF8FE]' : 'bg-white'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono-tabular text-xs font-bold text-[#6C5CE7]">
                        {tc.testCaseId}
                      </span>
                      <span className="font-semibold text-[#111111] text-[15px]">
                        {tc.title}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B6B80]">{tc.description}</p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                      tc.status === 'PASS'
                        ? 'bg-[#2EC4B6]/15 text-[#0F766E]'
                        : tc.status === 'FAIL'
                          ? 'bg-[#F472B6]/20 text-[#9D174D]'
                          : 'bg-[#ECE6F8] text-[#6B6B80]'
                    }`}
                  >
                    {tc.status === 'PASS' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {tc.status === 'FAIL' && <XCircle className="w-3.5 h-3.5" />}
                    {tc.status === 'NOT TESTED' && <MinusCircle className="w-3.5 h-3.5" />}
                    <span>{tc.status}</span>
                  </span>
                </div>

                {tc.checks.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {tc.checks.map((chk, i) => (
                      <div
                        key={i}
                        className="text-xs px-3 py-2 rounded-xl bg-white border border-[#ECE6F8] flex items-start gap-2"
                      >
                        {chk.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#2EC4B6] shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-[#E53935] shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-medium text-[#111111]">{chk.label}</div>
                          <div className="text-[#6B6B80] mt-0.5">{chk.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Search Evaluation Log Table */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-[#111111]">
          Search Evaluation Log
        </h2>

        {logs.length === 0 ? (
          <div className="bg-white rounded-[24px] p-10 text-center text-[#6B6B80]">
            No searches logged yet. Run a search on the Search page to record scores and inspect rankings here.
          </div>
        ) : (
          <div className="bg-white rounded-[24px] overflow-x-auto shadow-[0_14px_34px_rgba(60,70,120,0.08)]">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-[#ECE6F8] text-xs font-semibold text-[#6B6B80]">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Config / α</th>
                  <th className="py-3.5 px-4">Query Description</th>
                  <th className="py-3.5 px-4">Expected ID</th>
                  <th className="py-3.5 px-4">Test Tag</th>
                  <th className="py-3.5 px-4 text-right">Rank</th>
                  <th className="py-3.5 px-4 text-right">Top-1</th>
                  <th className="py-3.5 px-4 text-right">Top-5</th>
                  <th className="py-3.5 px-4 text-right">RR</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const m = computeLogMetrics(log);
                  const isExpanded = expandedLogId === log.id;
                  const zebraBg = idx % 2 === 1 ? 'bg-[#FAF8FE]' : 'bg-white';

                  return (
                    <React.Fragment key={log.id}>
                      <tr className={`${zebraBg} border-b border-[#ECE6F8]/70 text-xs`}>
                        <td className="py-3 px-4 font-mono-tabular text-[#6B6B80] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-medium text-[#111111]">{log.config}</span>
                          <span className="text-[#6B6B80] font-mono-tabular">
                            {' '}
                            (α={log.alphaEffective.toFixed(2)})
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-[220px] truncate text-[#333333]">
                          {log.validationError ? (
                            <span className="text-[#E53935] font-medium">
                              [Rejected: {log.validationError}]
                            </span>
                          ) : log.queryDescription ? (
                            log.queryDescription
                          ) : (
                            <span className="text-[#6B6B80] italic">(empty description)</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            aria-label={`Expected item ID for ${log.id}`}
                            placeholder="FI-001"
                            value={log.expectedItemId || ''}
                            onChange={(e) =>
                              void onUpdateLogEntry({
                                ...log,
                                expectedItemId: e.target.value,
                              })
                            }
                            className="w-24 px-2 py-1 rounded-lg border border-[#E2DAF5] bg-white text-xs font-mono-tabular focus:outline-none focus:border-[#6C5CE7]"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <select
                            aria-label={`Test case tag for ${log.id}`}
                            value={log.testCaseTag || ''}
                            onChange={(e) =>
                              void onUpdateLogEntry({
                                ...log,
                                testCaseTag: e.target.value as TestCaseId | '',
                              })
                            }
                            className="px-2 py-1 rounded-lg border border-[#E2DAF5] bg-white text-xs focus:outline-none focus:border-[#6C5CE7]"
                          >
                            <option value="">None</option>
                            <option value="TC-01">TC-01</option>
                            <option value="TC-02">TC-02</option>
                            <option value="TC-03">TC-03</option>
                            <option value="TC-04">TC-04</option>
                            <option value="TC-05">TC-05</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#111111]">
                          {m.rank !== null ? `#${m.rank}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {m.top1Hit === null ? '—' : m.top1Hit ? '1' : '0'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {m.top5Hit === null ? '—' : m.top5Hit ? '1' : '0'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {m.reciprocalRank !== null ? m.reciprocalRank.toFixed(2) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedLogId(isExpanded ? null : log.id)
                            }
                            className="inline-flex items-center gap-1 text-[#6C5CE7] font-semibold cursor-pointer hover:underline"
                          >
                            <span>{isExpanded ? 'Hide' : 'Ranks'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[#F3EEFB]/60">
                          <td colSpan={10} className="p-4">
                            <div className="text-xs text-[#6B6B80] mb-2 font-mono-tabular">
                              Log {log.id} · Gemini calls: {log.geminiCallsMade} · Image Hash:{' '}
                              {log.queryImageHash.slice(0, 14)}…
                            </div>
                            {log.rankedList.length === 0 ? (
                              <div className="text-xs text-[#333333]">
                                No ranked items recorded ({log.validationError || 'empty database'}).
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {log.rankedList.map((r) => (
                                  <div
                                    key={r.itemId}
                                    className="bg-white rounded-xl p-3 border border-[#ECE6F8] text-xs space-y-1"
                                  >
                                    <div className="flex items-center justify-between font-mono-tabular">
                                      <span className="font-bold text-[#111111]">
                                        #{r.rank} · {r.itemId} ({r.category})
                                      </span>
                                      <span className="font-bold text-[#6C5CE7]">
                                        Final {formatScorePercent(r.finalScore)}
                                      </span>
                                    </div>
                                    <div className="text-[#6B6B80] font-mono-tabular">
                                      Image: {formatScorePercent(r.sImage)} · Text:{' '}
                                      {formatScorePercent(r.sText)} · Baseline:{' '}
                                      {formatScorePercent(r.sBaseline)}
                                    </div>
                                    <div className="text-[#333333]">{r.reason}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
