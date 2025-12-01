/**
 * BeeHive Logo - Professional Honeycomb Mark with Detailed Hero Bee
 * 
 * Design specifications:
 * - 7-cell honeycomb flower pattern with precise 60° flat-top hex geometry
 * - Hero bee with full anatomy: antennae, compound eyes, thorax, 
 *   striped abdomen, 6 legs, wings, stinger
 * - Optimized for 64x64 viewBox, scales cleanly to all sizes
 * 
 * Brand colors: Honey (#F7B500), Nectar (#FFD34D), Mint (#00D9A3), Charcoal (#101113)
 */

interface BeeHiveLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  variant?: 'primary' | 'dark' | 'light';
  iconSize?: number;
  textHeight?: number;
  animated?: boolean;
}

const SIZE_MAP = {
  sm: 48,
  md: 64,
  lg: 96,
  xl: 128,
};

const SIZE_TEXT = {
  sm: '16px',
  md: '22px',
  lg: '32px',
  xl: '42px',
};

const VARIANT_COLORS = {
  primary: {
    text: '#101113',
    honey: '#F7B500',
    nectar: '#FFD34D',
    mint: '#00D9A3',
    stroke: '#E59B00',
    dark: '#101113',
    thorax: '#141B2E',
  },
  dark: {
    text: '#FFF8E6',
    honey: '#F7B500',
    nectar: '#FFD34D',
    mint: '#00D9A3',
    stroke: '#E59B00',
    dark: '#101113',
    thorax: '#141B2E',
  },
  light: {
    text: '#F7B500',
    honey: '#F7B500',
    nectar: '#FFD34D',
    mint: '#00D9A3',
    stroke: '#E59B00',
    dark: '#101113',
    thorax: '#141B2E',
  },
};

export function BeeHiveLogo({ 
  size = 'md', 
  className = '', 
  showText = true, 
  variant = 'primary', 
  iconSize, 
  textHeight,
  animated = true,
}: BeeHiveLogoProps) {
  const svgSize = iconSize || SIZE_MAP[size];
  const textSize = textHeight ? `${textHeight}px` : SIZE_TEXT[size];
  const colors = VARIANT_COLORS[variant];

  return (
    <div className={`inline-flex items-center ${showText ? 'gap-3' : ''} ${className}`}>
      {/* Professional Honeycomb Mark with Detailed Hero Bee */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        className="beehive-logo-mark"
      >
        <defs>
          {/* Honey gradient for cells */}
          <linearGradient id="honeyFill" x1="18" y1="14" x2="46" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={colors.nectar} />
            <stop offset="1" stopColor={colors.honey} />
          </linearGradient>
        </defs>

        {/* ========================================
            HONEYCOMB GRID - 7 cells in precise flower pattern
            Flat-top hexagons, size=8, 60° geometry
            ======================================== */}
        <g 
          id="honeycomb" 
          stroke={colors.stroke} 
          strokeWidth="1.25" 
          strokeLinejoin="round" 
          fill="url(#honeyFill)"
        >
          {/* Center hexagon */}
          <path d="M36 25.072 L28 25.072 L24 32 L28 38.928 L36 38.928 L40 32 Z"/>
          
          {/* Right hex */}
          <path d="M48 32 L40 32 L36 38.928 L40 45.856 L48 45.856 L52 38.928 Z"/>
          
          {/* Bottom-center hex */}
          <path d="M36 38.928 L28 38.928 L24 45.856 L28 52.784 L36 52.784 L40 45.856 Z"/>
          
          {/* Left hex */}
          <path d="M24 32 L16 32 L12 38.928 L16 45.856 L24 45.856 L28 38.928 Z"/>
          
          {/* Top-left hex */}
          <path d="M24 18.144 L16 18.144 L12 25.072 L16 32 L24 32 L28 25.072 Z"/>
          
          {/* Top-center hex */}
          <path d="M36 11.216 L28 11.216 L24 18.144 L28 25.072 L36 25.072 L40 18.144 Z"/>
          
          {/* Top-right hex */}
          <path d="M48 18.144 L40 18.144 L36 25.072 L40 32 L48 32 L52 25.072 Z"/>
        </g>

        {/* ========================================
            HERO BEE - Full anatomy
            Antennae, compound eyes, thorax, striped abdomen,
            6 legs, wings, stinger
            ======================================== */}
        <g 
          id="hero-bee" 
          className={animated ? "hero-bee" : ""}
          transform="translate(40 4)"
        >
          {/* Wings - translucent, overlapping */}
          <path 
            className={animated ? "bee-wing-left" : ""}
            d="M6.4 7.8 C1.8 4.4 1.9 1.5 7.2 2.3 C11.1 2.9 11.2 6.7 6.4 7.8 Z" 
            fill={colors.mint} 
            opacity="0.55"
          />
          <path 
            className={animated ? "bee-wing-right" : ""}
            d="M13.6 7.8 C18.2 4.4 18.1 1.5 12.8 2.3 C8.9 2.9 8.8 6.7 13.6 7.8 Z" 
            fill={colors.mint} 
            opacity="0.45"
          />
          
          {/* Head */}
          <circle cx="10" cy="6.6" r="2.2" fill={colors.dark} />
          
          {/* Antennae */}
          <path d="M8.6 4.6 Q8.2 2.8 7.0 2.2" stroke={colors.dark} strokeWidth="0.6" strokeLinecap="round" fill="none" />
          <path d="M11.4 4.6 Q11.8 2.8 13.0 2.2" stroke={colors.dark} strokeWidth="0.6" strokeLinecap="round" fill="none" />
          
          {/* Compound eyes */}
          <circle cx="9.2" cy="6.0" r="0.5" fill={colors.nectar} opacity="0.9" />
          <circle cx="10.8" cy="6.0" r="0.5" fill={colors.nectar} opacity="0.9" />
          
          {/* Thorax */}
          <ellipse cx="10" cy="9.6" rx="2.4" ry="1.8" fill={colors.thorax} />
          
          {/* Abdomen - striped */}
          <path 
            d="M10 11.4 C13.2 11.4 15 13.5 15 15.8 C15 18.2 13.2 20 10 20 C6.8 20 5 18.2 5 15.8 C5 13.5 6.8 11.4 10 11.4 Z" 
            fill={colors.honey} 
          />
          
          {/* Abdomen stripes */}
          <rect x="6.2" y="13.2" width="7.6" height="1.0" rx="0.5" fill={colors.dark} />
          <rect x="5.8" y="15.4" width="8.4" height="1.0" rx="0.5" fill={colors.dark} />
          <rect x="6.2" y="17.5" width="7.6" height="0.9" rx="0.45" fill={colors.dark} />
          
          {/* Stinger */}
          <path d="M10 20 L10 22" stroke={colors.dark} strokeWidth="0.8" strokeLinecap="round" />
          
          {/* Left legs (3) */}
          <path d="M6.2 12.4 L3.8 13.6" stroke={colors.dark} strokeWidth="0.7" strokeLinecap="round" />
          <path d="M5.6 14.8 L3.2 16.0" stroke={colors.dark} strokeWidth="0.7" strokeLinecap="round" />
          <path d="M5.8 17.2 L3.6 18.6" stroke={colors.dark} strokeWidth="0.7" strokeLinecap="round" />
          
          {/* Right legs (3) */}
          <path d="M13.8 12.4 L16.2 13.6" stroke={colors.dark} strokeWidth="0.7" strokeLinecap="round" />
          <path d="M14.4 14.8 L16.8 16.0" stroke={colors.dark} strokeWidth="0.7" strokeLinecap="round" />
          <path d="M14.2 17.2 L16.4 18.6" stroke={colors.dark} strokeWidth="0.7" strokeLinecap="round" />
        </g>

        {/* Small accent bee - adds depth, bottom area */}
        <g 
          id="accent-bee" 
          className={animated ? "accent-bee" : ""}
          transform="translate(2 46) scale(0.5)"
        >
          {/* Mini wings */}
          <ellipse cx="8" cy="4" rx="4" ry="2.5" fill={colors.mint} opacity="0.4" />
          <ellipse cx="12" cy="4" rx="4" ry="2.5" fill={colors.mint} opacity="0.35" />
          
          {/* Mini head */}
          <circle cx="10" cy="5" r="1.8" fill={colors.dark} />
          
          {/* Mini body */}
          <ellipse cx="10" cy="9" rx="2" ry="3.5" fill={colors.honey} />
          <rect x="8.2" y="7.5" width="3.6" height="0.7" rx="0.35" fill={colors.dark} />
          <rect x="8" y="9.2" width="4" height="0.7" rx="0.35" fill={colors.dark} />
          <rect x="8.2" y="10.8" width="3.6" height="0.6" rx="0.3" fill={colors.dark} />
        </g>
      </svg>

      {/* BeeHive Wordmark - Clean Typography */}
      {showText && (
        <div className="flex flex-col" style={{ lineHeight: 1 }}>
          <span
            style={{
              fontSize: textSize,
              fontWeight: 800,
              color: colors.honey,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            BeeHive
          </span>
          <span
            style={{
              fontSize: `calc(${textSize} * 0.32)`,
              fontWeight: 600,
              color: colors.honey,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: 0.75,
            }}
          >
            Collective
          </span>
        </div>
      )}
    </div>
  );
}

export default BeeHiveLogo;
