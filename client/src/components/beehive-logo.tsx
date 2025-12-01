/**
 * BeeHive Universal Queen Bee Logo
 * Professional hive-themed branding with clean, clear bee rendering
 * Uses brand colors (Honey, Nectar, Mint, Charcoal)
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
      {/* Queen Bee - Clean, Clear SVG */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 100 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* HEAD */}
        <circle cx="50" cy="25" r="7" fill={colors.text} />

        {/* CROWN - Royal mark */}
        <polygon points="48,19 50,15 52,19" fill={colors.accent} />
        <circle cx="50" cy="14" r="1.5" fill={colors.highlight} />

        {/* EYES */}
        <circle cx="47" cy="25" r="1.5" fill={colors.highlight} />
        <circle cx="53" cy="25" r="1.5" fill={colors.highlight} />

        {/* LEFT WING */}
        <ellipse cx="30" cy="40" rx="10" ry="16" fill="hsl(171, 100%, 42%)" opacity="0.75" />

        {/* RIGHT WING */}
        <ellipse cx="70" cy="40" rx="10" ry="16" fill="hsl(171, 100%, 42%)" opacity="0.75" />

        {/* THORAX */}
        <ellipse cx="50" cy="45" rx="9" ry="12" fill={colors.accent} />
        <rect x="44" y="43" width="12" height="1" fill={colors.text} opacity="0.4" />

        {/* ABDOMEN SEGMENT 1 */}
        <ellipse cx="50" cy="62" rx="8" ry="11" fill={colors.highlight} />
        <rect x="44" y="60" width="12" height="1" fill={colors.text} opacity="0.3" />

        {/* ABDOMEN SEGMENT 2 */}
        <ellipse cx="50" cy="77" rx="7" ry="10" fill={colors.accent} />
        <rect x="45" y="75" width="10" height="1" fill={colors.text} opacity="0.3" />

        {/* ABDOMEN SEGMENT 3 */}
        <ellipse cx="50" cy="90" rx="6" ry="8" fill={colors.highlight} />

        {/* STINGER */}
        <line x1="50" y1="98" x2="50" y2="108" stroke={colors.text} strokeWidth="1.2" />
        <polygon points="50,108 47,103 53,103" fill={colors.accent} />

        {/* FRONT LEGS */}
        <line x1="44" y1="48" x2="28" y2="35" stroke={colors.text} strokeWidth="1" opacity="0.6" />
        <line x1="56" y1="48" x2="72" y2="35" stroke={colors.text} strokeWidth="1" opacity="0.6" />

        {/* MIDDLE LEGS */}
        <line x1="43" y1="58" x2="25" y2="60" stroke={colors.text} strokeWidth="1" opacity="0.6" />
        <line x1="57" y1="58" x2="75" y2="60" stroke={colors.text} strokeWidth="1" opacity="0.6" />

        {/* BACK LEGS */}
        <line x1="45" y1="75" x2="30" y2="95" stroke={colors.text} strokeWidth="1" opacity="0.6" />
        <line x1="55" y1="75" x2="70" y2="95" stroke={colors.text} strokeWidth="1" opacity="0.6" />
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
