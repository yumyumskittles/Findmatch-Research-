import type { SearchLogEntry, TestCaseCheckResult, TestCaseId } from '../types';

export interface LogMetrics {
  rank: number | null;
  top1Hit: boolean | null;
  top5Hit: boolean | null;
  reciprocalRank: number | null;
}

export function computeLogMetrics(log: SearchLogEntry): LogMetrics {
  const expected = log.expectedItemId?.trim().toUpperCase();
  if (!expected || log.rankedList.length === 0) {
    return { rank: null, top1Hit: null, top5Hit: null, reciprocalRank: null };
  }

  const found = log.rankedList.find((r) => r.itemId.toUpperCase() === expected);
  if (!found) {
    return { rank: null, top1Hit: false, top5Hit: false, reciprocalRank: 0 };
  }

  return {
    rank: found.rank,
    top1Hit: found.rank === 1,
    top5Hit: found.rank <= 5,
    reciprocalRank: 1 / found.rank,
  };
}

export interface AggregateMetrics {
  evaluatedCount: number;
  top1Accuracy: number;
  top5Accuracy: number;
  mrr: number;
}

export function computeAggregateMetrics(logs: SearchLogEntry[]): AggregateMetrics {
  const evaluated = logs.filter((l) => Boolean(l.expectedItemId?.trim()) && l.rankedList.length > 0);
  if (evaluated.length === 0) {
    return { evaluatedCount: 0, top1Accuracy: 0, top5Accuracy: 0, mrr: 0 };
  }

  let top1Sum = 0;
  let top5Sum = 0;
  let rrSum = 0;

  for (const log of evaluated) {
    const m = computeLogMetrics(log);
    if (m.top1Hit) top1Sum++;
    if (m.top5Hit) top5Sum++;
    rrSum += m.reciprocalRank ?? 0;
  }

  return {
    evaluatedCount: evaluated.length,
    top1Accuracy: top1Sum / evaluated.length,
    top5Accuracy: top5Sum / evaluated.length,
    mrr: rrSum / evaluated.length,
  };
}

const TEST_CASE_META: Record<TestCaseId, { title: string; description: string }> = {
  'TC-01': {
    title: 'Valid photo + description of an item in the database',
    description:
      'Expected matching item appears in Top 5 (ideally #1) with scores in descending order.',
  },
  'TC-02': {
    title: 'Several near-identical items in the database',
    description:
      'All items of the query category are returned in ranked order; expected item ranks #1.',
  },
  'TC-03': {
    title: 'Photo only, no description',
    description:
      'Ranked results returned with α forced to 1.0, text score shown as "—", and image-only note visible.',
  },
  'TC-04': {
    title: 'Item not in the database',
    description:
      'Top score < 50%, "No strong match found" banner shown, no card uses the word "confirmed".',
  },
  'TC-05': {
    title: 'Unsupported or corrupted file',
    description:
      'Shows exact error "Please upload a valid image (JPG/PNG)", zero Gemini calls made, results empty.',
  },
};

export function evaluateTestCases(logs: SearchLogEntry[]): TestCaseCheckResult[] {
  const ids: TestCaseId[] = ['TC-01', 'TC-02', 'TC-03', 'TC-04', 'TC-05'];

  return ids.map((tcId) => {
    const meta = TEST_CASE_META[tcId];
    // Find the most recent log tagged with this test case
    const log = logs.find((l) => l.testCaseTag === tcId);
    if (!log) {
      return {
        testCaseId: tcId,
        title: meta.title,
        description: meta.description,
        status: 'NOT TESTED',
        checks: [],
      };
    }

    const checks: TestCaseCheckResult['checks'] = [];

    if (tcId === 'TC-01') {
      const hasResults = log.rankedList.length >= 1;
      checks.push({
        label: 'Results count ≥ 1',
        passed: hasResults,
        detail: `${log.rankedList.length} ranked item(s)`,
      });

      const nonIncreasing = isNonIncreasing(log.rankedList.map((r) => r.finalScore));
      checks.push({
        label: 'Scores in non-increasing order',
        passed: nonIncreasing,
        detail: nonIncreasing ? 'Descending order verified' : 'Score order violation detected',
      });

      const metrics = computeLogMetrics(log);
      const inTop5 = Boolean(log.expectedItemId && metrics.top5Hit);
      checks.push({
        label: 'Expected item ID within ranks 1–5',
        passed: inTop5,
        detail: log.expectedItemId
          ? metrics.rank
            ? `${log.expectedItemId} ranked #${metrics.rank}`
            : `${log.expectedItemId} not found in ranked list`
          : 'Set Expected Item ID on this log entry',
      });
    } else if (tcId === 'TC-02') {
      const qCat = log.queryCategory || log.rankedList[0]?.category;
      const expectedCatCount = qCat ? log.databaseCategoryCounts[qCat] || 0 : 0;
      const returnedCatCount = qCat
        ? log.rankedList.filter((r) => r.category === qCat).length
        : 0;
      const allCatReturned = expectedCatCount > 0 && returnedCatCount === expectedCatCount;
      checks.push({
        label: 'All items of query category returned',
        passed: allCatReturned,
        detail: qCat
          ? `${returnedCatCount}/${expectedCatCount} "${qCat}" items in ranked list`
          : 'Query category unknown',
      });

      const metrics = computeLogMetrics(log);
      const isTop1 = Boolean(log.expectedItemId && metrics.rank === 1);
      checks.push({
        label: 'Expected item ranked #1',
        passed: isTop1,
        detail: log.expectedItemId
          ? metrics.rank
            ? `${log.expectedItemId} ranked #${metrics.rank}`
            : `${log.expectedItemId} missing`
          : 'Set Expected Item ID on this log entry',
      });
    } else if (tcId === 'TC-03') {
      const hasResults = log.rankedList.length >= 1;
      checks.push({
        label: 'Results shown with empty description',
        passed: hasResults && log.queryDescription.trim() === '',
        detail: `${log.rankedList.length} result(s), description "${log.queryDescription}"`,
      });

      const alphaForced = Math.abs(log.alphaEffective - 1.0) < 1e-6;
      checks.push({
        label: 'α forced to 1.0',
        passed: alphaForced,
        detail: `Effective α = ${log.alphaEffective.toFixed(2)}`,
      });

      const textDash = log.rankedList.every((r) => r.sText === null);
      checks.push({
        label: 'Text score shown as "—"',
        passed: textDash,
        detail: textDash ? 'All text scores null ("—")' : 'Non-null text score found',
      });

      const noteVisible = log.usedImageOnlyFallback;
      checks.push({
        label: 'Image-only ranking note visible',
        passed: noteVisible,
        detail: noteVisible
          ? '"No description given — ranked by image similarity only."'
          : 'Fallback flag inactive',
      });
    } else if (tcId === 'TC-04') {
      const topScore = log.rankedList[0]?.finalScore ?? 0;
      const below50 = log.rankedList.length > 0 && topScore < 0.5;
      checks.push({
        label: 'Top score < 50% (triggers "No strong match found" banner)',
        passed: below50,
        detail:
          log.rankedList.length > 0
            ? `Top score = ${(topScore * 100).toFixed(1)}%`
            : 'No ranked items in database',
      });

      const noConfirmed = log.rankedList.every(
        (r) =>
          !r.reason.toLowerCase().includes('confirmed') &&
          !r.matchingFeatures.some((f) => f.toLowerCase().includes('confirmed')),
      );
      checks.push({
        label: 'No card uses the word "confirmed"',
        passed: noConfirmed,
        detail: noConfirmed ? 'Verified clean copy' : 'Forbidden word found',
      });
    } else if (tcId === 'TC-05') {
      const exactError = log.validationError === 'Please upload a valid image (JPG/PNG)';
      checks.push({
        label: 'Exact validation error message shown',
        passed: exactError,
        detail: log.validationError || 'No validation error recorded',
      });

      const zeroCalls = log.geminiCallsMade === 0;
      checks.push({
        label: 'Zero Gemini calls made',
        passed: zeroCalls,
        detail: `Gemini calls = ${log.geminiCallsMade}`,
      });

      const emptyResults = log.rankedList.length === 0;
      checks.push({
        label: 'Results area is empty',
        passed: emptyResults,
        detail: `${log.rankedList.length} results`,
      });
    }

    const allPassed = checks.length > 0 && checks.every((c) => c.passed);
    return {
      testCaseId: tcId,
      title: meta.title,
      description: meta.description,
      status: allPassed ? 'PASS' : 'FAIL',
      matchedLogId: log.id,
      checks,
    };
  });
}

function isNonIncreasing(nums: number[]): boolean {
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] > nums[i - 1] + 1e-6) return false;
  }
  return true;
}

export function exportLogsAsJson(logs: SearchLogEntry[]): void {
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `findmatch_evaluation_logs_${Date.now()}.json`);
}

export function exportLogsAsCsv(logs: SearchLogEntry[]): void {
  const headers = [
    'log_id',
    'timestamp',
    'test_case',
    'config',
    'alpha_configured',
    'alpha_effective',
    'query_description',
    'expected_item_id',
    'expected_rank',
    'top1_hit',
    'top5_hit',
    'reciprocal_rank',
    'gemini_calls',
    'validation_error',
    'top_1_item',
    'top_1_score',
    'ranked_summary',
  ];

  const escapeCsv = (val: unknown): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = logs.map((log) => {
    const m = computeLogMetrics(log);
    const summary = log.rankedList
      .map(
        (r) =>
          `#${r.rank}:${r.itemId}(final=${(r.finalScore * 100).toFixed(1)}%,img=${r.sImage !== null ? (r.sImage * 100).toFixed(1) + '%' : '—'},txt=${r.sText !== null ? (r.sText * 100).toFixed(1) + '%' : '—'})`,
      )
      .join(' | ');

    return [
      log.id,
      log.timestamp,
      log.testCaseTag || '',
      log.config,
      log.alphaConfigured.toFixed(2),
      log.alphaEffective.toFixed(2),
      log.queryDescription,
      log.expectedItemId || '',
      m.rank ?? '',
      m.top1Hit === null ? '' : m.top1Hit ? '1' : '0',
      m.top5Hit === null ? '' : m.top5Hit ? '1' : '0',
      m.reciprocalRank !== null ? m.reciprocalRank.toFixed(4) : '',
      log.geminiCallsMade,
      log.validationError || '',
      log.rankedList[0]?.itemId || '',
      log.rankedList[0] ? (log.rankedList[0].finalScore * 100).toFixed(1) + '%' : '',
      summary,
    ]
      .map(escapeCsv)
      .join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `findmatch_evaluation_logs_${Date.now()}.csv`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
