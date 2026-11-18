import { useCallback, useEffect, useState } from 'react';
import type {
  FoundItem,
  MatchConfig,
  PageId,
  SearchExecutionResult,
  SearchLogEntry,
  TestCaseId,
} from './types';
import {
  clearAllSearchLogs,
  getAllFoundItems,
  getAllSearchLogs,
  saveFoundItem,
  saveSearchLog,
} from './lib/db';
import { loadSampleFoundItems } from './lib/sampleData';
import { Navbar } from './components/Navbar';
import { SearchPage } from './components/SearchPage';
import { RegisterPage } from './components/RegisterPage';
import { ResultsView } from './components/ResultsView';
import { EvaluationPage } from './components/EvaluationPage';
import { AboutPage } from './components/AboutPage';

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('search');
  const [items, setItems] = useState<FoundItem[]>([]);
  const [logs, setLogs] = useState<SearchLogEntry[]>([]);
  const [matchConfig, setMatchConfig] = useState<MatchConfig>('combined');
  const [alpha, setAlpha] = useState<number>(0.6);
  const [expectedItemId, setExpectedItemId] = useState<string>('');
  const [testCaseTag, setTestCaseTag] = useState<TestCaseId | ''>('');
  const [latestResult, setLatestResult] = useState<SearchExecutionResult | null>(null);
  const [sampleLoadingText, setSampleLoadingText] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

  const refreshItems = useCallback(async () => {
    const loaded = await getAllFoundItems();
    setItems(loaded);
  }, []);

  const refreshLogs = useCallback(async () => {
    const loaded = await getAllSearchLogs();
    setLogs(loaded);
  }, []);

  useEffect(() => {
    void refreshItems();
    void refreshLogs();
  }, [refreshItems, refreshLogs]);

  const handleRequestVerification = async (item: FoundItem) => {
    const updated: FoundItem = {
      ...item,
      verificationStatus: 'pending_verification',
      verificationRequestedAt: new Date().toISOString(),
    };
    await saveFoundItem(updated);
    await refreshItems();

    setLatestResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rankedCandidates: prev.rankedCandidates.map((c) =>
          c.itemId === item.id ? { ...c, item: updated } : c,
        ),
      };
    });
  };

  const handleLoadSampleData = async () => {
    if (sampleLoadingText) return;
    setSampleError(null);
    setSampleLoadingText('Loading sample items...');
    try {
      await loadSampleFoundItems((_cur, _tot, label) => {
        setSampleLoadingText(label);
      });
      await refreshItems();
    } catch (err: unknown) {
      setSampleError(
        err instanceof Error ? err.message : 'Failed to load sample dataset.',
      );
    } finally {
      setSampleLoadingText(null);
    }
  };

  const handleUpdateLogEntry = async (updated: SearchLogEntry) => {
    await saveSearchLog(updated);
    await refreshLogs();
  };

  const handleClearLogs = async () => {
    await clearAllSearchLogs();
    await refreshLogs();
  };

  return (
    <div className="min-h-screen bg-[#9DB4D8] py-4 px-3 sm:py-8 sm:px-6 md:py-12 md:px-10">
      <div
        className="mx-auto max-w-[1400px] rounded-[40px] p-6 min-[900px]:p-16 shadow-[0_30px_60px_rgba(60,70,120,0.25)]"
        style={{
          background: 'linear-gradient(155deg, #F3EEFB 0%, #ECE6F8 100%)',
        }}
      >
        <Navbar
          activePage={activePage}
          onNavigate={setActivePage}
          itemCount={items.length}
          resultsCount={latestResult?.rankedCandidates.length ?? 0}
        />

        {sampleError && (
          <div
            role="alert"
            className="mb-6 rounded-[18px] bg-[#FEF2F2] border border-[#E53935]/30 px-4 py-3 text-sm text-[#B91C1C]"
          >
            {sampleError}
          </div>
        )}

        <main>
          {activePage === 'search' && (
            <SearchPage
              items={items}
              matchConfig={matchConfig}
              alpha={alpha}
              expectedItemId={expectedItemId}
              testCaseTag={testCaseTag}
              onExpectedItemIdChange={setExpectedItemId}
              onTestCaseTagChange={setTestCaseTag}
              latestResult={latestResult}
              onSearchCompleted={setLatestResult}
              onLogRecorded={refreshLogs}
              onRequestVerification={handleRequestVerification}
              onLoadSampleData={handleLoadSampleData}
              sampleLoadingText={sampleLoadingText}
            />
          )}

          {activePage === 'register' && (
            <RegisterPage
              items={items}
              onItemsChanged={refreshItems}
              onLoadSampleData={handleLoadSampleData}
              sampleLoadingText={sampleLoadingText}
            />
          )}

          {activePage === 'results' && (
            <ResultsView
              searchResult={latestResult}
              onRequestVerification={handleRequestVerification}
              onGoToSearch={() => setActivePage('search')}
            />
          )}

          {activePage === 'evaluation' && (
            <EvaluationPage
              matchConfig={matchConfig}
              alpha={alpha}
              onConfigChange={setMatchConfig}
              onAlphaChange={setAlpha}
              logs={logs}
              onUpdateLogEntry={handleUpdateLogEntry}
              onClearLogs={handleClearLogs}
            />
          )}

          {activePage === 'about' && <AboutPage />}
        </main>
      </div>
    </div>
  );
}
