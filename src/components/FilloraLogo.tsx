import React, { useId } from 'react';

export interface FilloraLogoProps {
  /** Logo variant:
   * - 'mark': Icon mark only
   * - 'full': Mark + typography + badge
   * - 'compact': Mark + typography (no badge)
   * - 'hero': Large centered showcase presentation for landing / empty state
   */
  variant?: 'mark' | 'full' | 'compact' | 'hero';

  /** Preset or custom pixel size of the mark tile:
   * - 'sm': 28px
   * - 'md': 34px (default for top navbar)
   * - 'lg': 44px
   * - 'xl': 60px
   * - '2xl': 80px (for empty state hero)
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;

  /** Whether to show the pill badge in 'full' or 'hero' mode */
  showBadge?: boolean;

  /** Custom badge text (defaults to 'AI Form Filler') */
  badgeText?: string;

  /** Custom class for the wrapper container */
  className?: string;

  /** Optional click handler (e.g. reset or navigate) */
  onClick?: () => void;
}

export const FilloraLogo: React.FC<FilloraLogoProps> = ({
  variant = 'full',
  size = 'md',
  showBadge = true,
  badgeText = 'AI Form Filler',
  className = '',
  onClick,
}) => {
  const uid = useId().replace(/:/g, '');

  // Calculate mark dimension in pixels
  const getPixelSize = (): number => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'sm':
        return 28;
      case 'md':
        return 34;
      case 'lg':
        return 44;
      case 'xl':
        return 60;
      case '2xl':
        return 80;
      default:
        return 34;
    }
  };

  const px = getPixelSize();

  // The standalone SVG vector mark
  const MarkSvg = (
    <div
      className="relative shrink-0 select-none group"
      style={{ width: px, height: px }}
    >
      <svg
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
      >
        <defs>
          {/* Background Gradient */}
          <linearGradient id={`bg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="50%" stopColor="#3730A3" />
            <stop offset="100%" stopColor="#1E1B4B" />
          </linearGradient>

          {/* Top Arm Gradient */}
          <linearGradient id={`top-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E0E7FF" />
          </linearGradient>

          {/* Vertical Stem Gradient */}
          <linearGradient id={`stem-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#C7D2FE" />
          </linearGradient>

          {/* Active Form Field Fill Gradient */}
          <linearGradient id={`field-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="55%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>

          {/* Sparkle Gradient */}
          <linearGradient id={`spark-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#A7F3D0" />
          </linearGradient>

          {/* Subtle Drop Shadow Filter */}
          <filter id={`shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.38" />
          </filter>

          {/* Ambient Glow Filter */}
          <filter id={`glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Container Squircle with Glass Highlight */}
        <rect width="128" height="128" rx="28" fill={`url(#bg-${uid})`} />
        <rect
          x="0.75"
          y="0.75"
          width="126.5"
          height="126.5"
          rx="27.25"
          stroke="white"
          strokeOpacity="0.2"
          strokeWidth="1.5"
        />

        {/* Ambient Light Orbs */}
        <circle cx="98" cy="26" r="30" fill="#38BDF8" opacity="0.28" filter={`url(#glow-${uid})`} />
        <circle cx="32" cy="98" r="26" fill="#6366F1" opacity="0.32" filter={`url(#glow-${uid})`} />

        {/* Monogram F / Intelligent Document Mark */}
        <g filter={`url(#shadow-${uid})`}>
          {/* Vertical Spine (Document Edge) */}
          <rect x="28" y="26" width="16" height="76" rx="8" fill={`url(#stem-${uid})`} />

          {/* Top Arm: Document Header & Margin with clean fold bevel */}
          <rect x="36" y="26" width="56" height="16" rx="8" fill={`url(#top-${uid})`} />

          {/* Document Fold Bevel at Top-Right */}
          <path d="M92 26 L80 26 C80 30.418 83.582 34 88 34 L92 34 Z" fill="#818CF8" opacity="0.55" />

          {/* Middle Arm: Active Intelligent Form Field Bar */}
          <rect x="36" y="55" width="48" height="16" rx="8" fill={`url(#field-${uid})`} />

          {/* Checkmark inside the Active Field */}
          <path
            d="M68 63 L72.5 67.5 L80 59"
            stroke="#042F2E"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Neural AI Sparkle (Top-Right) */}
          <g transform="translate(91, 20) scale(0.95)">
            <path
              d="M12 0 C12 6.627 6.627 12 0 12 C6.627 12 12 17.373 12 24 C12 17.373 17.373 12 24 12 C17.373 12 12 6.627 12 0 Z"
              fill={`url(#spark-${uid})`}
            />
            <circle cx="12" cy="12" r="2.5" fill="#FFFFFF" />
          </g>
        </g>
      </svg>
    </div>
  );

  if (variant === 'mark') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        {MarkSvg}
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div
        onClick={onClick}
        className={`flex flex-col items-center text-center select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        <div className="relative mb-4">
          <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 via-cyan-500/20 to-emerald-500/20 rounded-full blur-xl animate-pulse" />
          {MarkSvg}
        </div>
        <div className="flex items-center space-x-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 font-sans">
            Fill<span className="text-indigo-600">ora</span>
          </h1>
          {showBadge && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {badgeText}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500 font-medium tracking-normal">
          Privacy-First AI Form Detection & Intelligent Filling
        </p>
      </div>
    );
  }

  // 'full' or 'compact'
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center space-x-2.5 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {MarkSvg}
      <div className="flex items-center">
        <span className="font-extrabold text-gray-900 text-[15px] tracking-tight leading-none">
          Fill<span className="text-indigo-600">ora</span>
        </span>
        {variant === 'full' && showBadge && (
          <span className="hidden sm:inline-flex items-center ml-2 px-1.5 py-0.5 text-[10px] bg-indigo-50/80 text-indigo-700 font-semibold rounded-md border border-indigo-200/70 shadow-2xs leading-none">
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
};
