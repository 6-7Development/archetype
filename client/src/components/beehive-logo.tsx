/**
 * BeeHive Queen Bee Logo - Clean Geometric Design
 * Modern bee with animated wings via universal CSS animations
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
    wing: 'hsl(171, 100%, 42%)',
  },
  dark: {
    text: 'hsl(47, 100%, 95%)',
    accent: 'hsl(40, 97%, 50%)',
    highlight: 'hsl(48, 100%, 65%)',
    wing: 'hsl(171, 100%, 42%)',
  },
  light: {
    text: 'hsl(40, 97%, 50%)',
    accent: 'hsl(171, 100%, 42%)',
    highlight: 'hsl(48, 100%, 65%)',
    wing: 'hsl(171, 100%, 42%)',
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

  return (
    <div className={`inline-flex items-center ${showText ? 'gap-3' : ''} ${className}`}>
      {/* Queen Bee - Clean Geometric Design */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 100 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        className="bee-wing"
      >
        {/* LEFT WING - Large mint teal with animation */}
        <ellipse
          className={`bee-wing-left-${wingAnimation}`}
          cx="22"
          cy="45"
          rx="16"
          ry="28"
          fill={colors.wing}
          opacity="0.85"
        />

        {/* RIGHT WING - Large mint teal with animation */}
        <ellipse
          className={`bee-wing-right-${wingAnimation}`}
          cx="78"
          cy="45"
          rx="16"
          ry="28"
          fill={colors.wing}
          opacity="0.85"
        />

        {/* HEAD - Small black circle at top */}
        <circle cx="50" cy="18" r="7" fill={colors.text} />

        {/* EYES - Simple white dots */}
        <circle cx="46" cy="16" r="1.5" fill={colors.highlight} />
        <circle cx="54" cy="16" r="1.5" fill={colors.highlight} />

        {/* ANTENNAE - Curved lines extending upward */}
        <path
          d="M 45 12 Q 42 6 40 2"
          stroke={colors.text}
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 55 12 Q 58 6 60 2"
          stroke={colors.text}
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />

        {/* BODY SEGMENT 1 - Top yellow stripe */}
        <ellipse
          cx="50"
          cy="32"
          rx="10"
          ry="9"
          fill={colors.highlight}
        />

        {/* Black divider line after segment 1 */}
        <rect
          x="40"
          y="40"
          width="20"
          height="1.5"
          fill={colors.text}
          opacity="0.9"
        />

        {/* BODY SEGMENT 2 - Gold stripe */}
        <ellipse
          cx="50"
          cy="51"
          rx="11"
          ry="10"
          fill={colors.accent}
        />

        {/* Black divider line after segment 2 */}
        <rect
          x="39"
          y="60"
          width="22"
          height="1.5"
          fill={colors.text}
          opacity="0.9"
        />

        {/* BODY SEGMENT 3 - Yellow stripe */}
        <ellipse
          cx="50"
          cy="71"
          rx="11"
          ry="10"
          fill={colors.highlight}
        />

        {/* Black divider line after segment 3 */}
        <rect
          x="39"
          y="80"
          width="22"
          height="1.5"
          fill={colors.text}
          opacity="0.9"
        />

        {/* BODY SEGMENT 4 - Gold stripe (larger) */}
        <ellipse
          cx="50"
          cy="92"
          rx="12"
          ry="11"
          fill={colors.accent}
        />

        {/* Black divider line after segment 4 */}
        <rect
          x="38"
          y="102"
          width="24"
          height="1.5"
          fill={colors.text}
          opacity="0.9"
        />

        {/* STINGER - Sharp point */}
        <path
          d="M 48 105 L 50 118 L 52 105 Z"
          fill={colors.text}
          opacity="0.95"
        />

        {/* Subtle legs visible on sides */}
        <g stroke={colors.text} strokeWidth="0.8" opacity="0.5">
          <line x1="40" y1="50" x2="28" y2="48" strokeLinecap="round" />
          <line x1="60" y1="50" x2="72" y2="48" strokeLinecap="round" />
          <line x1="40" y1="70" x2="26" y2="75" strokeLinecap="round" />
          <line x1="60" y1="70" x2="74" y2="75" strokeLinecap="round" />
        </g>
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
