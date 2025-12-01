/**
 * BeeHive Universal Queen Bee Logo
 * Professional hive-themed branding with animated bee and enhanced wordmark
 * Uses brand colors (Honey, Nectar, Mint, Charcoal) with premium styling
 */

interface BeeHiveLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  variant?: 'primary' | 'dark' | 'light';
  iconSize?: number;
  textHeight?: number;
}

const SIZE_MAP = {
  sm: 40,
  md: 60,
  lg: 100,
  xl: 140,
};

const SIZE_TEXT = {
  sm: '14px',
  md: '20px',
  lg: '32px',
  xl: '44px',
};

const VARIANT_COLORS = {
  primary: {
    text: 'hsl(216, 9%, 7%)',
    accent: 'hsl(40, 97%, 50%)',
    highlight: 'hsl(48, 100%, 65%)',
  },
  dark: {
    text: 'hsl(47, 100%, 95%)',
    accent: 'hsl(40, 97%, 50%)',
    highlight: 'hsl(48, 100%, 65%)',
  },
  light: {
    text: 'hsl(40, 97%, 50%)',
    accent: 'hsl(171, 100%, 42%)',
    highlight: 'hsl(48, 100%, 65%)',
  },
};

export function BeeHiveLogo({ size = 'md', className = '', showText = true, variant = 'primary', iconSize, textHeight }: BeeHiveLogoProps) {
  const svgSize = iconSize || SIZE_MAP[size];
  const textSize = textHeight ? `${textHeight}px` : SIZE_TEXT[size];
  const colors = VARIANT_COLORS[variant];

  return (
    <div className={`inline-flex items-center ${showText ? 'gap-3' : ''} ${className}`}>
      {/* Queen Bee - Enhanced SVG with premium styling */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 100 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))' }}
      >
        <defs>
          <linearGradient id="honeyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: colors.highlight, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: colors.accent, stopOpacity: 1 }} />
          </linearGradient>
          <radialGradient id="bodyGrad" cx="50%" cy="30%">
            <stop offset="0%" style={{ stopColor: colors.highlight, stopOpacity: 0.8 }} />
            <stop offset="100%" style={{ stopColor: colors.accent, stopOpacity: 1 }} />
          </radialGradient>
        </defs>

        {/* HEXAGON CELL - Premium border with gradient */}
        <path
          d="M50 10 L72 22 L72 46 L50 58 L28 46 L28 22 Z"
          stroke={colors.accent}
          strokeWidth="1.5"
          opacity="0.4"
        />

        {/* GLOW EFFECT - Subtle aura */}
        <circle cx="50" cy="60" r="38" fill={colors.accent} opacity="0.05" />

        {/* WINGS - LEFT (enhanced with glow) */}
        <ellipse
          cx="25"
          cy="42"
          rx="12"
          ry="20"
          fill="hsl(171, 100%, 42%)"
          opacity="0.7"
          style={{
            animation: 'wing-flap 0.4s ease-in-out infinite',
            transformBox: 'fill-box',
            transformOrigin: 'center',
            filter: 'drop-shadow(0 1px 2px rgba(0, 212, 179, 0.3))',
          }}
        />

        {/* WINGS - RIGHT */}
        <ellipse
          cx="75"
          cy="42"
          rx="12"
          ry="20"
          fill="hsl(171, 100%, 42%)"
          opacity="0.7"
          style={{
            animation: 'wing-flap 0.4s ease-in-out infinite 0.2s',
            transformBox: 'fill-box',
            transformOrigin: 'center',
            filter: 'drop-shadow(0 1px 2px rgba(0, 212, 179, 0.3))',
          }}
        />

        {/* HEAD */}
        <circle cx="50" cy="28" r="8" fill={colors.text} />

        {/* CROWN - Royal mark with gradient */}
        <g fill={colors.accent}>
          <polygon points="48,22 50,18 52,22 51,24 49,24" />
          <circle cx="50" cy="18" r="1.2" fill={colors.highlight} />
        </g>

        {/* EYES - Bright and expressive */}
        <circle cx="47" cy="27" r="1.2" fill={colors.highlight} />
        <circle cx="53" cy="27" r="1.2" fill={colors.highlight} />

        {/* THORAX - Gradient body */}
        <ellipse cx="50" cy="48" rx="10" ry="13" fill="url(#bodyGrad)" />

        {/* THORAX STRIPE */}
        <rect
          x="43"
          y="46"
          width="14"
          height="1.5"
          rx="0.5"
          fill={colors.text}
          opacity="0.5"
        />

        {/* LEGS - Professional styling */}
        <g stroke={colors.text} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.7">
          <path d="M46 45 L28 32" />
          <path d="M54 45 L72 32" />
          <path d="M45 52 L22 65" />
          <path d="M55 52 L78 65" />
          <path d="M48 58 L28 80" />
          <path d="M52 58 L72 80" />
        </g>

        {/* ABDOMEN - Main body with gradient */}
        <ellipse cx="50" cy="82" rx="9" ry="18" fill="url(#honeyGrad)" />

        {/* ABDOMEN STRIPES */}
        <g fill={colors.text} opacity="0.6">
          <rect x="44" y="66" width="12" height="1.5" rx="0.5" />
          <rect x="43" y="75" width="14" height="1.5" rx="0.5" />
          <rect x="44" y="84" width="12" height="1.5" rx="0.5" />
          <rect x="45" y="93" width="10" height="1.5" rx="0.5" />
        </g>

        {/* STINGER - Elegant point */}
        <g>
          <line
            x1="50"
            y1="100"
            x2="50"
            y2="110"
            stroke={colors.text}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <polygon points="50,110 47,104 53,104" fill={colors.accent} />
        </g>

        {/* Wing animation */}
        <style>{`
          @keyframes wing-flap {
            0%, 100% {
              transform: scaleY(1) rotateZ(-8deg);
              opacity: 0.7;
            }
            50% {
              transform: scaleY(0.7) rotateZ(8deg);
              opacity: 0.9;
            }
          }
        `}</style>
      </svg>

      {/* BeeHive Wordmark - Enhanced Typography */}
      {showText && (
        <div className="flex flex-col" style={{ lineHeight: 1 }}>
          <span
            style={{
              fontSize: textSize,
              fontWeight: 900,
              background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.highlight} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              textShadow: 'none',
            }}
          >
            BeeHive
          </span>
          <span
            style={{
              fontSize: `${parseInt(textSize) * 0.35}px`,
              fontWeight: 600,
              color: colors.accent,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              letterSpacing: '0.05em',
              marginTop: '2px',
              opacity: 0.85,
            }}
          >
            COLLECTIVE
          </span>
        </div>
      )}
    </div>
  );
}

export default BeeHiveLogo;
