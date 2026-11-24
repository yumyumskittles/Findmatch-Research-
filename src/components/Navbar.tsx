import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { PageId } from '../types';

interface NavbarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  itemCount: number;
  resultsCount: number;
}

const NAV_ITEMS: Array<{ id: PageId; label: string }> = [
  { id: 'search', label: 'Search' },
  { id: 'register', label: 'Register Item' },
  { id: 'results', label: 'Results' },
  { id: 'about', label: 'About' },
];

export const Navbar: React.FC<NavbarProps> = ({
  activePage,
  onNavigate,
  itemCount,
  resultsCount,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSelect = (page: PageId) => {
    onNavigate(page);
    setDrawerOpen(false);
  };

  return (
    <>
      <header className="flex items-center justify-between gap-8 pb-8 md:pb-12">
        {/* Zone 1: Logo — magnifying glass over a tag + wordmark */}
        <button
          type="button"
          onClick={() => handleSelect('search')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7] rounded-lg"
          aria-label="FindMatch home"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
            aria-hidden="true"
          >
            {/* Tag outline */}
            <path
              d="M4.5 6.5C4.5 5.39543 5.39543 4.5 6.5 4.5H12.1716C12.702 4.5 13.2107 4.71071 13.5858 5.08579L21.0858 12.5858C21.8668 13.3668 21.8668 14.6332 21.0858 15.4142L15.4142 21.0858C14.6332 21.8668 13.3668 21.8668 12.5858 21.0858L5.08579 13.5858C4.71071 13.2107 4.5 12.702 4.5 12.1716V6.5Z"
              stroke="#111111"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="9" cy="9" r="1.25" fill="#111111" />
            {/* Magnifying glass overlapping */}
            <circle
              cx="18.5"
              cy="18.5"
              r="5"
              fill="#F3EEFB"
              stroke="#6C5CE7"
              strokeWidth="2"
            />
            <path
              d="M22.2 22.2L25 25"
              stroke="#6C5CE7"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-display text-[22px] font-bold tracking-tight text-[#111111]">
            findmatch.
          </span>
        </button>

        {/* Zone 2: Center Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden min-[900px]:flex items-center gap-8"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative py-1.5 text-[15px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7] rounded ${
                  isActive
                    ? 'text-[#6C5CE7] font-semibold'
                    : 'text-[#6B6B80] hover:text-[#111111]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[#6C5CE7] rounded-full"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Minimal two-line hamburger icon */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            className="w-11 h-11 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-white/60 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7]"
          >
            <span className="w-6 h-[2px] bg-[#111111] rounded-full block" />
            <span className="w-6 h-[2px] bg-[#111111] rounded-full block" />
          </button>
        </div>
      </header>

      {/* Slide-over Navigation Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#111111]/25 backdrop-blur-xs"
          onClick={() => setDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation drawer"
        >
          <div
            className="w-full max-w-xs bg-[#F5F1FC] h-full p-8 shadow-2xl flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between pb-8 border-b border-[#6C5CE7]/15">
                <span className="font-display text-xl font-bold text-[#111111]">
                  findmatch.
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-[#333333] hover:bg-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-8 flex flex-col gap-2">
                {NAV_ITEMS.map((item) => {
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={`w-full text-left px-4 py-3 rounded-2xl text-[16px] font-medium transition-colors cursor-pointer flex items-center justify-between ${
                        isActive
                          ? 'bg-[#6C5CE7] text-white'
                          : 'text-[#333333] hover:bg-white/80'
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.id === 'register' && (
                        <span
                          className={`text-xs font-mono-tabular ${
                            isActive ? 'text-white/80' : 'text-[#6B6B80]'
                          }`}
                        >
                          {itemCount}
                        </span>
                      )}
                      {item.id === 'results' && resultsCount > 0 && (
                        <span
                          className={`text-xs font-mono-tabular ${
                            isActive ? 'text-white/80' : 'text-[#6B6B80]'
                          }`}
                        >
                          {resultsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-6 border-t border-[#6C5CE7]/15 text-xs text-[#6B6B80] space-y-1">
              <p className="font-medium text-[#333333]">Thesis Prototype</p>
              <p>{itemCount} found item(s) saved in the database.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
