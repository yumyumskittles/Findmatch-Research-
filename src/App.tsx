import { useCallback, useEffect, useState } from 'react';
import type { FoundItem, MatchConfig, PageId, SearchExecutionResult } from './types';
import { getAllFoundItems, saveFoundItem } from './lib/db';
import { loadSampleFoundItems } from './lib/sampleData';
import { Navbar } from './components/Navbar';
import { SearchPage } from './components/SearchPage';
import { RegisterPage } from './components/RegisterPage';
import { ResultsView } from './components/ResultsView';
import { AboutPage } from './components/AboutPage';

// Image and description are combined: 60% photo, 40% description.
const MATCH_CONFIG: MatchConfig = 'combined';
const ALPHA = 0.6;

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('search');
  const [items, setItems] = useState<FoundItem[]>([]);
  const [latestResult, setLatestResult] = useState<SearchExecutionResult | null>(null);
  const [sampleLoadingText, setSampleLoadingText] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

  const refreshItems = useCallback(async () => {
    const loaded = await getAllFoundItems();
    setItems(loaded);
  }, []);

  useEffect(() => {
    refreshItems().catch((err) => {
      setSampleError(
        err instanceof Error
          ? `Could not load items from Firebase: ${err.message}`
          : 'Could not load items from Firebase.',
      );
    });
  }, [refreshItems]);

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
              matchConfig={MATCH_CONFIG}
              alpha={ALPHA}
              latestResult={latestResult}
              onSearchCompleted={setLatestResult}
              onLogRecorded={async () => {}}
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

          {activePage === 'about' && <AboutPage />}
        </main>
      </div>
    </div>
  );
}
