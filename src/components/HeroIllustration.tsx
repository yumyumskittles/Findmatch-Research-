import React from 'react';

export const HeroIllustration: React.FC = () => {
  return (
    <div
      className="relative w-full max-w-[520px] mx-auto select-none"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 540 460"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-[0_24px_40px_rgba(60,70,120,0.18)]"
      >
        <defs>
          <linearGradient id="phoneBody" x1="160" y1="55" x2="365" y2="415" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="55%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient id="phoneScreen" x1="178" y1="80" x2="345" y2="390" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EFF6FF" />
            <stop offset="100%" stopColor="#DBEAFE" />
          </linearGradient>
          <linearGradient id="yellowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#F5C518" />
          </linearGradient>
          <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5EEAD4" />
            <stop offset="100%" stopColor="#2EC4B6" />
          </linearGradient>
          <linearGradient id="violetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B7CF6" />
            <stop offset="100%" stopColor="#6C5CE7" />
          </linearGradient>
          <linearGradient id="pinkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F9A8D4" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#3C4678" floodOpacity="0.2" />
          </filter>
          <filter id="pillShadow" x="-15%" y="-30%" width="130%" height="180%">
            <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#2A3362" floodOpacity="0.22" />
          </filter>
        </defs>

        {/* Soft ambient lavender halo */}
        <ellipse cx="270" cy="245" rx="195" ry="165" fill="#E3D9F7" opacity="0.55" />
        <ellipse cx="270" cy="415" rx="145" ry="18" fill="#6C5CE7" opacity="0.12" />

        {/* Rounded 3D Blue Phone */}
        <g filter="url(#softShadow)">
          {/* Phone side depth */}
          <rect x="166" y="62" width="206" height="346" rx="38" fill="#1D4ED8" />
          {/* Phone main casing */}
          <rect x="158" y="54" width="206" height="346" rx="38" fill="url(#phoneBody)" />
          {/* Inner glossy bezel highlight */}
          <rect x="162" y="58" width="198" height="338" rx="34" stroke="#93C5FD" strokeWidth="2" strokeOpacity="0.7" />
          {/* Screen */}
          <rect x="174" y="74" width="174" height="306" rx="26" fill="url(#phoneScreen)" />
          {/* Speaker notch */}
          <rect x="237" y="84" width="48" height="6" rx="3" fill="#93C5FD" opacity="0.7" />
          {/* Screen UI skeleton cards */}
          <rect x="192" y="110" width="138" height="72" rx="16" fill="#FFFFFF" opacity="0.9" />
          <circle cx="218" cy="146" r="14" fill="#E0E7FF" />
          <rect x="242" y="135" width="70" height="8" rx="4" fill="#CBD5E1" />
          <rect x="242" y="151" width="46" height="7" rx="3.5" fill="#E2E8F0" />

          <rect x="192" y="252" width="138" height="52" rx="14" fill="#FFFFFF" opacity="0.85" />
          <rect x="208" y="268" width="84" height="8" rx="4" fill="#CBD5E1" />
          <rect x="208" y="283" width="54" height="7" rx="3.5" fill="#E2E8F0" />

          <rect x="192" y="316" width="138" height="44" rx="14" fill="#FFFFFF" opacity="0.75" />
          <rect x="208" y="334" width="68" height="8" rx="4" fill="#CBD5E1" />
        </g>

        {/* Teal chat bubble with three dots (top right) */}
        <g className="animate-float-2" filter="url(#softShadow)">
          <rect x="356" y="76" width="108" height="66" rx="24" fill="url(#tealGrad)" />
          <path d="M376 138L364 156L396 140Z" fill="#2EC4B6" />
          <rect x="360" y="80" width="100" height="58" rx="21" stroke="#A7F3D0" strokeWidth="1.5" strokeOpacity="0.65" />
          <circle cx="390" cy="109" r="5.5" fill="#FFFFFF" />
          <circle cx="410" cy="109" r="5.5" fill="#FFFFFF" />
          <circle cx="430" cy="109" r="5.5" fill="#FFFFFF" />
        </g>

        {/* Blue chat bubble (left lower) */}
        <g className="animate-float-4" filter="url(#softShadow)">
          <rect x="58" y="264" width="110" height="64" rx="22" fill="url(#phoneBody)" />
          <path d="M148 324L164 340L132 326Z" fill="#2563EB" />
          <rect x="78" y="287" width="66" height="7" rx="3.5" fill="#FFFFFF" opacity="0.9" />
          <rect x="78" y="301" width="44" height="7" rx="3.5" fill="#BFDBFE" opacity="0.9" />
        </g>

        {/* Photo Card (top left) */}
        <g className="animate-float-3" filter="url(#softShadow)">
          <g transform="rotate(-8 110 130)">
            <rect x="52" y="76" width="112" height="106" rx="20" fill="#FFFFFF" />
            <rect x="64" y="88" width="88" height="62" rx="12" fill="#EDE9FE" />
            {/* Mountain / item silhouette in photo card */}
            <circle cx="90" cy="108" r="9" fill="url(#pinkGrad)" />
            <path d="M68 148L94 120L114 136L128 122L148 148H68Z" fill="#6C5CE7" opacity="0.75" />
            <rect x="66" y="160" width="58" height="7" rx="3.5" fill="#CBD5E1" />
          </g>
        </g>

        {/* Lost-item Tag Icon (bottom left below bubble) */}
        <g className="animate-float-1" filter="url(#softShadow)">
          <g transform="rotate(-14 128 386)">
            <path
              d="M90 360C90 352.268 96.268 346 104 346H136L164 374L132 406L104 378C96.268 370 90 367.732 90 360Z"
              fill="url(#pinkGrad)"
            />
            <circle cx="110" cy="364" r="5" fill="#FFFFFF" />
          </g>
        </g>

        {/* Floating Pill-Shaped Search Bar crossing the phone */}
        <g className="animate-float-1" filter="url(#pillShadow)">
          <rect x="116" y="192" width="298" height="58" rx="29" fill="#FFFFFF" />
          <rect x="120" y="196" width="290" height="50" rx="25" stroke="#EDE9FE" strokeWidth="1.5" />
          {/* Placeholder query text lines */}
          <rect x="148" y="216" width="126" height="10" rx="5" fill="#E2E8F0" />
          <rect x="284" y="216" width="54" height="10" rx="5" fill="#EDE9FE" />
          {/* Round violet magnifier button inside pill */}
          <circle cx="383" cy="221" r="21" fill="url(#violetGrad)" />
          <circle cx="381" cy="219" r="7" stroke="#FFFFFF" strokeWidth="2.4" />
          <path d="M386.5 224.5L391.5 229.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
        </g>

        {/* Yellow Cursor Arrow */}
        <g className="animate-float-5" filter="url(#softShadow)">
          <path
            d="M366 236L402 252L386 258L380 274L366 236Z"
            fill="url(#yellowGrad)"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </g>

        {/* Yellow Envelope with Red Notification Dot (bottom right) */}
        <g className="animate-float-3" filter="url(#softShadow)">
          <g transform="rotate(7 415 340)">
            <rect x="356" y="302" width="114" height="78" rx="18" fill="url(#yellowGrad)" />
            <path
              d="M364 312L413 348L462 312"
              stroke="#FEF08A"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="360" y="306" width="106" height="70" rx="15" stroke="#FEF9C3" strokeWidth="1.5" strokeOpacity="0.7" />
          </g>
          {/* Red notification dot */}
          <circle cx="468" cy="306" r="12" fill="#E53935" stroke="#FFFFFF" strokeWidth="3" />
        </g>

        {/* Yellow 3D Magnifying Glass (mid right) */}
        <g className="animate-float-4" filter="url(#softShadow)">
          <g transform="rotate(-24 446 218)">
            <rect x="441" y="236" width="14" height="44" rx="7" fill="#D97706" />
            <rect x="441" y="236" width="14" height="40" rx="7" fill="url(#yellowGrad)" />
            <circle cx="448" cy="204" r="32" fill="url(#yellowGrad)" />
            <circle cx="448" cy="204" r="21" fill="#EFF6FF" fillOpacity="0.92" />
            <path d="M437 195C440 190 446 188 452 190" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </div>
  );
};
