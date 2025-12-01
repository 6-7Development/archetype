/**
 * BeeHive Logo - Professional Honeycomb Mark with Hero Bee
 * 
 * Design principles:
 * - Bold stacked honeycomb as primary focal point
 * - Single hero bee anchored at upper-right for narrative focus
 * - Precise 60° hex geometry with consistent stroke hierarchy
 * - Simplified bee anatomy: head, thorax, striped abdomen, wing pair
 * - Subtle animation that enhances rather than overwhelms
 * 
 * Brand colors: Honey (#F7B500), Nectar (#FFD34D), Mint (#00D4B3), Charcoal (#101113)
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
    text: 'hsl(216, 9%, 7%)',
    honey: 'hsl(40, 97%, 48%)',
    nectar: 'hsl(48, 100%, 65%)',
    mint: 'hsl(171, 100%, 42%)',
    dark: 'hsl(216, 11%, 15%)',
  },
  dark: {
    text: 'hsl(47, 100%, 95%)',
    honey: 'hsl(40, 97%, 50%)',
    nectar: 'hsl(48, 100%, 68%)',
    mint: 'hsl(171, 100%, 45%)',
    dark: 'hsl(216, 11%, 25%)',
  },
  light: {
    text: 'hsl(40, 97%, 50%)',
    honey: 'hsl(40, 97%, 52%)',
    nectar: 'hsl(48, 100%, 70%)',
    mint: 'hsl(171, 100%, 42%)',
    dark: 'hsl(216, 9%, 20%)',
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
      {/* Professional Honeycomb Mark with Hero Bee */}
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
          <linearGradient id="honeyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.nectar} />
            <stop offset="100%" stopColor={colors.honey} />
          </linearGradient>
          
          {/* Subtle shadow for depth */}
          <filter id="cellShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15"/>
          </filter>
        </defs>

        {/* ========================================
            HONEYCOMB GRID - 7 hexagons in flower pattern
            Using precise 60° geometry
            ======================================== */}
        
        {/* Center hexagon - largest, focal point */}
        <path
          d="M32 12 L44 20 L44 36 L32 44 L20 36 L20 20 Z"
          fill="url(#honeyGrad)"
          stroke={colors.honey}
          strokeWidth="1.5"
          filter="url(#cellShadow)"
        />
        
        {/* Top-left hex */}
        <path
          d="M20 4 L29 9 L29 19 L20 24 L11 19 L11 9 Z"
          fill="url(#honeyGrad)"
          stroke={colors.honey}
          strokeWidth="1"
          opacity="0.85"
        />
        
        {/* Top-right hex */}
        <path
          d="M44 4 L53 9 L53 19 L44 24 L35 19 L35 9 Z"
          fill="url(#honeyGrad)"
          stroke={colors.honey}
          strokeWidth="1"
          opacity="0.85"
        />
        
        {/* Left hex */}
        <path
          d="M8 20 L17 25 L17 35 L8 40 L-1 35 L-1 25 Z"
          fill="url(#honeyGrad)"
          stroke={colors.honey}
          strokeWidth="1"
          opacity="0.7"
        />
        
        {/* Right hex */}
        <path
          d="M56 20 L65 25 L65 35 L56 40 L47 35 L47 25 Z"
          fill="url(#honeyGrad)"
          stroke={colors.honey}
          strokeWidth="1"
          opacity="0.7"
        />
        
        {/* Bottom-left hex */}
        <path
          d="M20 40 L29 45 L29 55 L20 60 L11 55 L11 45 Z"
          fill="url(#honeyGrad)"
          stroke={colors.honey}
          strokeWidth="1"
          opacity="0.6"
        />
        
        {/* Bottom-right hex */}
        <path
          d="M44 40 L53 45 L53 55 L44 60 L35 55 L35 45 Z"
          fill="url(#honeyGrad)"
          stroke={colors.honey}
          strokeWidth="1"
          opacity="0.6"
        />

        {/* ========================================
            HERO BEE - Upper right, narrative focus
            Anatomically correct: head, thorax, abdomen, wings
            ======================================== */}
        <g 
          className={animated ? "hero-bee" : ""} 
          transform="translate(46, 2)"
        >
          {/* Wings - translucent, behind body */}
          <ellipse
            className={animated ? "bee-wing-left" : ""}
            cx="4"
            cy="6"
            rx="5"
            ry="3"
            fill={colors.mint}
            opacity="0.5"
            transform="rotate(-30 4 6)"
          />
          <ellipse
            className={animated ? "bee-wing-right" : ""}
            cx="12"
            cy="6"
            rx="5"
            ry="3"
            fill={colors.mint}
            opacity="0.5"
            transform="rotate(30 12 6)"
          />
          
          {/* Head - small dark circle with eyes */}
          <circle cx="8" cy="4" r="2.5" fill={colors.dark} />
          <circle cx="7" cy="3.5" r="0.6" fill={colors.nectar} opacity="0.9" />
          <circle cx="9" cy="3.5" r="0.6" fill={colors.nectar} opacity="0.9" />
          
          {/* Thorax - middle section */}
          <ellipse cx="8" cy="8" rx="2.5" ry="2" fill={colors.dark} />
          
          {/* Abdomen - striped pattern (3 stripes) */}
          <ellipse cx="8" cy="13" rx="3" ry="4" fill={colors.honey} />
          <ellipse cx="8" cy="11.5" rx="2.8" ry="1" fill={colors.dark} />
          <ellipse cx="8" cy="14" rx="2.5" ry="0.8" fill={colors.dark} />
          
          {/* Stinger */}
          <path d="M8 16.5 L8 18" stroke={colors.dark} strokeWidth="0.8" strokeLinecap="round" />
        </g>

        {/* Small accent bee - bottom left, adds depth */}
        <g 
          className={animated ? "accent-bee" : ""} 
          transform="translate(2, 48) scale(0.6)"
        >
          {/* Simplified mini bee */}
          <ellipse cx="6" cy="4" rx="3" ry="2" fill={colors.mint} opacity="0.4" transform="rotate(-20 6 4)" />
          <ellipse cx="10" cy="4" rx="3" ry="2" fill={colors.mint} opacity="0.4" transform="rotate(20 10 4)" />
          <circle cx="8" cy="3" r="1.5" fill={colors.dark} />
          <ellipse cx="8" cy="7" rx="2" ry="3" fill={colors.honey} />
          <ellipse cx="8" cy="6" rx="1.8" ry="0.6" fill={colors.dark} />
          <ellipse cx="8" cy="8" rx="1.5" ry="0.5" fill={colors.dark} />
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
