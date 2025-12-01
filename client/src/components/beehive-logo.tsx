/**
 * BeeHive Logo - Premium Honeycomb Mark with Polished Hero Bee
 * 
 * Design specifications:
 * - 7-cell honeycomb with inner shading, highlights, and depth effects
 * - Hero bee with enhanced anatomy: antennae, compound eyes with shine,
 *   detailed thorax, striped abdomen, articulated legs, translucent wings
 * - Professional polish: gradients, shadows, highlights
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
    stroke: '#D4860F',
    dark: '#101113',
    thorax: '#141B2E',
    honeyDark: '#E39200',
  },
  dark: {
    text: '#FFF8E6',
    honey: '#F7B500',
    nectar: '#FFD34D',
    mint: '#00D9A3',
    stroke: '#D4860F',
    dark: '#101113',
    thorax: '#141B2E',
    honeyDark: '#E39200',
  },
  light: {
    text: '#F7B500',
    honey: '#F7B500',
    nectar: '#FFD34D',
    mint: '#00D9A3',
    stroke: '#D4860F',
    dark: '#101113',
    thorax: '#141B2E',
    honeyDark: '#E39200',
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
      {/* Professional Honeycomb Mark with Polished Hero Bee */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        className="beehive-logo-mark"
      >
        <defs>
          {/* Primary honey gradient */}
          <linearGradient id="honeyFill" x1="18" y1="14" x2="46" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={colors.nectar} />
            <stop offset="1" stopColor={colors.honey} />
          </linearGradient>
          
          {/* Inner cell shadow gradient */}
          <radialGradient id="cellShadow" cx="40%" cy="40%">
            <stop offset="0" stopColor={colors.nectar} stopOpacity="0.4" />
            <stop offset="1" stopColor={colors.honey} stopOpacity="0" />
          </radialGradient>

          {/* Bee glow effect */}
          <filter id="beeGlow">
            <feGaussianBlur stdDeviation="0.8" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* ========================================
            HONEYCOMB GRID - 7 cells with polish
            Flat-top hexagons, size=8, 60° geometry
            ======================================== */}
        
        {/* Shadow/depth layer */}
        <g opacity="0.15">
          <path d="M36 25.072 L28 25.072 L24 32 L28 38.928 L36 38.928 L40 32 Z" fill="#000" />
          <path d="M48 32 L40 32 L36 38.928 L40 45.856 L48 45.856 L52 38.928 Z" fill="#000" />
          <path d="M36 38.928 L28 38.928 L24 45.856 L28 52.784 L36 52.784 L40 45.856 Z" fill="#000" />
          <path d="M24 32 L16 32 L12 38.928 L16 45.856 L24 45.856 L28 38.928 Z" fill="#000" />
          <path d="M24 18.144 L16 18.144 L12 25.072 L16 32 L24 32 L28 25.072 Z" fill="#000" />
          <path d="M36 11.216 L28 11.216 L24 18.144 L28 25.072 L36 25.072 L40 18.144 Z" fill="#000" />
          <path d="M48 18.144 L40 18.144 L36 25.072 L40 32 L48 32 L52 25.072 Z" fill="#000" />
        </g>

        {/* Honeycomb cells with inner details */}
        <g 
          id="honeycomb" 
          stroke={colors.stroke} 
          strokeWidth="1.25" 
          strokeLinejoin="round"
        >
          {/* Center hexagon */}
          <path d="M36 25.072 L28 25.072 L24 32 L28 38.928 L36 38.928 L40 32 Z" fill="url(#honeyFill)" />
          {/* Inner shadow for center */}
          <path d="M36 25.072 L28 25.072 L24 32 L28 38.928 L36 38.928 L40 32 Z" fill="url(#cellShadow)" opacity="0.3" />
          
          {/* Right hex */}
          <path d="M48 32 L40 32 L36 38.928 L40 45.856 L48 45.856 L52 38.928 Z" fill="url(#honeyFill)" />
          
          {/* Bottom-center hex */}
          <path d="M36 38.928 L28 38.928 L24 45.856 L28 52.784 L36 52.784 L40 45.856 Z" fill="url(#honeyFill)" />
          
          {/* Left hex */}
          <path d="M24 32 L16 32 L12 38.928 L16 45.856 L24 45.856 L28 38.928 Z" fill="url(#honeyFill)" />
          
          {/* Top-left hex */}
          <path d="M24 18.144 L16 18.144 L12 25.072 L16 32 L24 32 L28 25.072 Z" fill="url(#honeyFill)" />
          
          {/* Top-center hex */}
          <path d="M36 11.216 L28 11.216 L24 18.144 L28 25.072 L36 25.072 L40 18.144 Z" fill="url(#honeyFill)" />
          
          {/* Top-right hex */}
          <path d="M48 18.144 L40 18.144 L36 25.072 L40 32 L48 32 L52 25.072 Z" fill="url(#honeyFill)" />
        </g>

        {/* Highlight on top edges for polish */}
        <g stroke={colors.nectar} strokeWidth="0.6" fill="none" opacity="0.6">
          <path d="M28 25.072 L36 25.072" />
          <path d="M40 18.144 L48 18.144" />
          <path d="M16 18.144 L24 18.144" />
        </g>

        {/* ========================================
            HERO BEE - Enhanced anatomy with polish
            Larger scale, more detail, professional finish
            ======================================== */}
        <g 
          id="hero-bee" 
          className={animated ? "hero-bee" : ""}
          transform="translate(38 2)"
          filter={animated ? "url(#beeGlow)" : ""}
        >
          {/* Wings - detailed, translucent with polish */}
          <path 
            className={animated ? "bee-wing-left" : ""}
            d="M5.8 7.4 C1.2 4.2 1.4 1.2 6.8 2.0 C11.0 2.6 11.2 6.4 5.8 7.4 Z" 
            fill={colors.mint} 
            opacity="0.58"
            strokeWidth="0.4"
            stroke={colors.mint}
            strokeOpacity="0.3"
          />
          <path 
            className={animated ? "bee-wing-right" : ""}
            d="M14.2 7.4 C18.8 4.2 18.6 1.2 13.2 2.0 C9.0 2.6 8.8 6.4 14.2 7.4 Z" 
            fill={colors.mint} 
            opacity="0.48"
            strokeWidth="0.4"
            stroke={colors.mint}
            strokeOpacity="0.3"
          />
          
          {/* Head with full detail */}
          <circle cx="10" cy="6.4" r="2.3" fill={colors.dark} />
          <circle cx="10" cy="6.4" r="2.3" fill={colors.dark} />
          
          {/* Eye shine/highlights */}
          <circle cx="9.0" cy="5.8" r="0.55" fill={colors.nectar} opacity="0.95" />
          <circle cx="11.0" cy="5.8" r="0.55" fill={colors.nectar} opacity="0.95" />
          <circle cx="8.75" cy="5.55" r="0.25" fill="#FFF" opacity="0.7" />
          <circle cx="10.75" cy="5.55" r="0.25" fill="#FFF" opacity="0.7" />
          
          {/* Antennae - more articulated */}
          <path d="M8.4 4.2 Q7.8 2.6 6.6 1.8" stroke={colors.dark} strokeWidth="0.7" strokeLinecap="round" fill="none" />
          <path d="M11.6 4.2 Q12.2 2.6 13.4 1.8" stroke={colors.dark} strokeWidth="0.7" strokeLinecap="round" fill="none" />
          <circle cx="6.6" cy="1.8" r="0.35" fill={colors.dark} />
          <circle cx="13.4" cy="1.8" r="0.35" fill={colors.dark} />
          
          {/* Thorax with shading */}
          <ellipse cx="10" cy="9.2" rx="2.6" ry="2.0" fill={colors.thorax} />
          <ellipse cx="10" cy="9.0" rx="2.4" ry="0.6" fill={colors.dark} opacity="0.3" />
          
          {/* Abdomen - professional striping */}
          <path 
            d="M10 11.2 C13.5 11.2 15.4 13.4 15.4 15.9 C15.4 18.5 13.5 20.4 10 20.4 C6.5 20.4 4.6 18.5 4.6 15.9 C4.6 13.4 6.5 11.2 10 11.2 Z" 
            fill={colors.honey} 
          />
          
          {/* Abdomen stripes - premium look */}
          <ellipse cx="10" cy="12.9" rx="3.6" ry="1.0" fill={colors.dark} opacity="0.35" />
          <rect x="6.2" y="13.2" width="7.6" height="1.1" rx="0.55" fill={colors.honeyDark} />
          
          <ellipse cx="10" cy="15.2" rx="3.8" ry="1.1" fill={colors.dark} opacity="0.25" />
          <rect x="5.8" y="15.2" width="8.4" height="1.2" rx="0.6" fill={colors.dark} opacity="0.4" />
          
          <ellipse cx="10" cy="17.6" rx="3.5" ry="0.95" fill={colors.dark} opacity="0.3" />
          <rect x="6.2" y="17.8" width="7.6" height="1.0" rx="0.5" fill={colors.honeyDark} />
          
          {/* Stinger - pointed */}
          <path d="M10 20.4 L10 22.2" stroke={colors.dark} strokeWidth="0.9" strokeLinecap="round" />
          <path d="M10 22.2 L9.3 23.0" stroke={colors.dark} strokeWidth="0.7" strokeLinecap="round" />
          <path d="M10 22.2 L10.7 23.0" stroke={colors.dark} strokeWidth="0.7" strokeLinecap="round" />
          
          {/* Legs - articulated detail */}
          <g stroke={colors.dark} strokeWidth="0.75" fill="none" strokeLinecap="round">
            {/* Left legs */}
            <path d="M6.2 12.6 L3.8 13.9 L3.4 14.8" />
            <path d="M5.6 15.0 L3.0 16.3 L2.4 17.4" />
            <path d="M5.8 17.6 L3.4 19.1 L2.8 20.2" />
            
            {/* Right legs */}
            <path d="M13.8 12.6 L16.2 13.9 L16.6 14.8" />
            <path d="M14.4 15.0 L17.0 16.3 L17.6 17.4" />
            <path d="M14.2 17.6 L16.6 19.1 L17.2 20.2" />
          </g>
        </g>

        {/* SWARMING BEES - Micro bees orbiting the honeycomb */}
        
        {/* Swarm bee 1 - top right */}
        <g 
          className={animated ? "swarm-bee swarm-bee-1" : ""}
          transform="translate(44 12)"
        >
          <ellipse cx="0" cy="0" rx="2.2" ry="1.6" fill={colors.mint} opacity="0.45" />
          <circle cx="0" cy="2" r="1.2" fill={colors.honey} />
          <circle cx="0" cy="1" r="0.7" fill={colors.dark} />
        </g>

        {/* Swarm bee 2 - right */}
        <g 
          className={animated ? "swarm-bee swarm-bee-2" : ""}
          transform="translate(55 30)"
        >
          <ellipse cx="0" cy="0" rx="2.2" ry="1.6" fill={colors.mint} opacity="0.45" />
          <circle cx="0" cy="2" r="1.2" fill={colors.honey} />
          <circle cx="0" cy="1" r="0.7" fill={colors.dark} />
        </g>

        {/* Swarm bee 3 - bottom right */}
        <g 
          className={animated ? "swarm-bee swarm-bee-3" : ""}
          transform="translate(46 50)"
        >
          <ellipse cx="0" cy="0" rx="2.2" ry="1.6" fill={colors.mint} opacity="0.45" />
          <circle cx="0" cy="2" r="1.2" fill={colors.honey} />
          <circle cx="0" cy="1" r="0.7" fill={colors.dark} />
        </g>

        {/* Swarm bee 4 - bottom left */}
        <g 
          className={animated ? "swarm-bee swarm-bee-4" : ""}
          transform="translate(16 50)"
        >
          <ellipse cx="0" cy="0" rx="2.2" ry="1.6" fill={colors.mint} opacity="0.45" />
          <circle cx="0" cy="2" r="1.2" fill={colors.honey} />
          <circle cx="0" cy="1" r="0.7" fill={colors.dark} />
        </g>

        {/* Swarm bee 5 - left */}
        <g 
          className={animated ? "swarm-bee swarm-bee-5" : ""}
          transform="translate(8 30)"
        >
          <ellipse cx="0" cy="0" rx="2.2" ry="1.6" fill={colors.mint} opacity="0.45" />
          <circle cx="0" cy="2" r="1.2" fill={colors.honey} />
          <circle cx="0" cy="1" r="0.7" fill={colors.dark} />
        </g>

        {/* Swarm bee 6 - top left */}
        <g 
          className={animated ? "swarm-bee swarm-bee-6" : ""}
          transform="translate(18 12)"
        >
          <ellipse cx="0" cy="0" rx="2.2" ry="1.6" fill={colors.mint} opacity="0.45" />
          <circle cx="0" cy="2" r="1.2" fill={colors.honey} />
          <circle cx="0" cy="1" r="0.7" fill={colors.dark} />
        </g>
      </svg>

      {/* BeeHive Wordmark - Clean Premium Typography */}
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
