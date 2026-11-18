import React from 'react';
import { Layers, ShieldCheck, Sparkles, Target } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-[#E53935] inline-block" aria-hidden="true" />
          <span className="text-[13px] font-bold tracking-[0.25em] uppercase text-[#6C5CE7]">
            Thesis Prototype
          </span>
        </div>
        <h1 className="font-display text-3xl md:text-5xl font-semibold text-[#111111] mt-2 tracking-tight">
          How FindMatch Works
        </h1>
        <p className="text-[17px] text-[#333333] mt-3 max-w-2xl leading-relaxed">
          FindMatch is a research prototype designed to distinguish near-identical lost and found belongings — such as two black water bottles or five gray umbrellas — by combining fine-grained visual inspection with distinctive mark matching.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-[24px] p-7 shadow-[0_14px_34px_rgba(60,70,120,0.08)] space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-[#F3EEFB] text-[#6C5CE7] flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <h2 className="font-display text-xl font-semibold text-[#111111]">
            01. Multi-Stage Feature Extraction
          </h2>
          <p className="text-sm text-[#333333] leading-relaxed">
            Every validated JPG/PNG is oriented, resized to a 1024px longest side, and analyzed locally with an 8×4×4 HSV histogram and 64-bit dHash, alongside a structured Gemini Flash visual profile and text embedding.
          </p>
        </div>

        <div className="bg-white rounded-[24px] p-7 shadow-[0_14px_34px_rgba(60,70,120,0.08)] space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-[#F3EEFB] text-[#6C5CE7] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <h2 className="font-display text-xl font-semibold text-[#111111]">
            02. Rubric-Driven Visual Comparison
          </h2>
          <p className="text-sm text-[#333333] leading-relaxed">
            Shortlisted candidates are compared side-by-side against the query image. Matching stickers, scratches, logos, or labels raise the score above 0.90, while missing or conflicting marks cap scores below 0.40 even for identical models.
          </p>
        </div>

        <div className="bg-white rounded-[24px] p-7 shadow-[0_14px_34px_rgba(60,70,120,0.08)] space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-[#F3EEFB] text-[#6C5CE7] flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <h2 className="font-display text-xl font-semibold text-[#111111]">
            03. Tunable Image-Text Fusion
          </h2>
          <p className="text-sm text-[#333333] leading-relaxed">
            Final similarity blends fine-grained visual score and rescaled embedding similarity using α = 0.60 by default, with +0.10 bonuses per matched distinctive mark. Photo-only queries automatically switch to α = 1.00.
          </p>
        </div>

        <div className="bg-white rounded-[24px] p-7 shadow-[0_14px_34px_rgba(60,70,120,0.08)] space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-[#F3EEFB] text-[#6C5CE7] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="font-display text-xl font-semibold text-[#111111]">
            04. Privacy &amp; In-Person Verification
          </h2>
          <p className="text-sm text-[#333333] leading-relaxed">
            All found-item records and logs persist locally in your browser via IndexedDB. FindMatch never declares ownership automatically — candidates always require in-person verification with lost-and-found staff.
          </p>
        </div>
      </div>
    </div>
  );
};
