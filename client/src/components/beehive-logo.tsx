/**
 * BeeHive Queen Bee Logo - Professional Thorax Design
 * Graphic bee with animated wings via universal CSS animations
 * Uses brand colors (Honey, Nectar, Mint, Charcoal)
 * 
 * Wing animations are defined in index.css for easy holiday customization
 */

interface BeeHiveLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  variant?: 'primary' | 'dark' | 'light';
  iconSize?: number;
  textHeight?: number;
  wingAnimation?: 'standard' | 'christmas' | 'halloween' | 'summer' | 'spring';
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

export function BeeHiveLogo({ 
  size = 'md', 
  className = '', 
  showText = true, 
  variant = 'primary', 
  iconSize, 
  textHeight,
  wingAnimation = 'standard'
}: BeeHiveLogoProps) {
  const svgSize = iconSize || SIZE_MAP[size];
  const textSize = textHeight ? `${textHeight}px` : SIZE_TEXT[size];
  const colors = VARIANT_COLORS[variant];
  const gradId = `honeyGrad-${Math.random().toString(36).substr(2, 9)}`;
  const thoraxGradId = `thoraxGrad-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`inline-flex items-center ${showText ? 'gap-3' : ''} ${className}`}>
      {/* Queen Bee - Professional Thorax Design with Universal CSS Animated Wings */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 100 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        className="bee-wing"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.highlight} />
            <stop offset="100%" stopColor={colors.accent} />
          </linearGradient>
          <radialGradient id={thoraxGradId} cx="50%" cy="30%">
            <stop offset="0%" stopColor={colors.highlight} />
            <stop offset="100%" stopColor={colors.accent} />
          </radialGradient>
        </defs>

        {/* Honeycomb Hexagon - Background accent */}
        <path
          d="M50 12 L68 22 L68 42 L50 52 L32 42 L32 22 Z"
          stroke={colors.accent}
          strokeWidth="1"
          fill="none"
          opacity="0.3"
        />

        {/* LEFT WING - Uses universal CSS animation from index.css */}
        <ellipse
          className={`bee-wing-left-${wingAnimation}`}
          cx="28"
          cy="42"
          rx="11"
          ry="19"
          fill="hsl(171, 100%, 42%)"
          opacity="0.75"
        />

        {/* RIGHT WING - Uses universal CSS animation from index.css */}
        <ellipse
          className={`bee-wing-right-${wingAnimation}`}
          cx="72"
          cy="42"
          ry="19"
          rx="11"
          fill="hsl(171, 100%, 42%)"
          opacity="0.75"
        />

        {/* HEAD - Dark charcoal with gradient sheen */}
        <circle cx="50" cy="28" r="8" fill={colors.text} />

        {/* CROWN - Royal marking with honey accent */}
        <g fill={colors.accent}>
          <polygon points="48,21 50,17 52,21 51,23 49,23" />
          <circle cx="50" cy="16" r="1.5" fill={colors.highlight} />
        </g>

        {/* EYES - Bright nectar highlights */}
        <circle cx="47" cy="27" r="1.8" fill={colors.highlight} />
        <circle cx="53" cy="27" r="1.8" fill={colors.highlight} />

        {/* THORAX (MIDDLE BODY) - Premium segment with gradient */}
        <ellipse
          cx="50"
          cy="48"
          rx="10"
          ry="13"
          fill={`url(#${thoraxGradId})`}
        />

        {/* Thorax highlight stripe */}
        <rect
          x="43"
          y="46"
          width="14"
          height="2"
          rx="1"
          fill={colors.text}
          opacity="0.4"
        />

        {/* LEGS - Professional rendering (6 total) */}
        <g stroke={colors.text} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.7">
          {/* Front pair */}
          <path d="M46 45 L28 32" />
          <path d="M54 45 L72 32" />
          {/* Middle pair */}
          <path d="M45 52 L22 65" />
          <path d="M55 52 L78 65" />
          {/* Back pair */}
          <path d="M48 58 L28 80" />
          <path d="M52 58 L72 80" />
        </g>

        {/* ABDOMEN SEGMENT 1 - Nectar gradient */}
        <ellipse
          cx="50"
          cy="68"
          rx="8.5"
          ry="10"
          fill={colors.highlight}
        />
        <rect
          x="44"
          y="66"
          width="12"
          height="1.5"
          rx="0.5"
          fill={colors.text}
          opacity="0.5"
        />

        {/* ABDOMEN SEGMENT 2 - Honey gold */}
        <ellipse
          cx="50"
          cy="83"
          rx="8"
          ry="11"
          fill={colors.accent}
        />
        <rect
          x="44"
          y="81"
          width="12"
          height="1.5"
          rx="0.5"
          fill={colors.text}
          opacity="0.4"
        />

        {/* ABDOMEN SEGMENT 3 - Gradient transition */}
        <ellipse
          cx="50"
          cy="97"
          rx="7"
          ry="9"
          fill={colors.highlight}
        />
        <rect
          x="45"
          y="95"
          width="10"
          height="1.5"
          rx="0.5"
          fill={colors.text}
          opacity="0.3"
        />

        {/* STINGER - Elegant point with accent */}
        <line
          x1="50"
          y1="106"
          x2="50"
          y2="116"
          stroke={colors.text}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <polygon points="50,116 47,109 53,109" fill={colors.accent} />

        {/* Subtle glow effect around body */}
        <circle cx="50" cy="65" r="32" fill={colors.accent} opacity="0.04" />
      </svg>

      {/* BeeHive Wordmark - Enhanced Typography */}
      {showText && (
        <div className="flex flex-col" style={{ lineHeight: 1 }}>
          <span
            style={{
              fontSize: textSize,
              fontWeight: 900,
              color: colors.accent,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              letterSpacing: '-0.02em',
              lineHeight: 1,
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
