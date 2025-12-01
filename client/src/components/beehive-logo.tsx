/**
 * BeeHive Queen Bee Logo - Realistic Compact Design
 * Professional bee with animated wings via universal CSS animations
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
    secondary: 'hsl(265, 50%, 35%)',
  },
  dark: {
    text: 'hsl(47, 100%, 95%)',
    accent: 'hsl(40, 97%, 50%)',
    highlight: 'hsl(48, 100%, 65%)',
    wing: 'hsl(171, 100%, 42%)',
    secondary: 'hsl(265, 50%, 55%)',
  },
  light: {
    text: 'hsl(40, 97%, 50%)',
    accent: 'hsl(171, 100%, 42%)',
    highlight: 'hsl(48, 100%, 65%)',
    wing: 'hsl(171, 100%, 42%)',
    secondary: 'hsl(265, 50%, 35%)',
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
      {/* Queen Bee - Realistic Compact Design */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        className="bee-wing"
      >
        {/* UPPER LEFT WING - Front wing */}
        <ellipse
          className={`bee-wing-left-${wingAnimation}`}
          cx="18"
          cy="35"
          rx="13"
          ry="22"
          fill={colors.wing}
          opacity="0.8"
          style={{ transformOrigin: '35px 40px' }}
        />

        {/* UPPER RIGHT WING - Front wing */}
        <ellipse
          className={`bee-wing-right-${wingAnimation}`}
          cx="82"
          cy="35"
          rx="13"
          ry="22"
          fill={colors.wing}
          opacity="0.8"
          style={{ transformOrigin: '65px 40px' }}
        />

        {/* LOWER LEFT WING - Back wing (more transparent) */}
        <ellipse
          className={`bee-wing-left-${wingAnimation}`}
          cx="22"
          cy="55"
          rx="11"
          ry="20"
          fill={colors.wing}
          opacity="0.5"
          style={{ transformOrigin: '35px 60px', animationDelay: '0.1s' }}
        />

        {/* LOWER RIGHT WING - Back wing (more transparent) */}
        <ellipse
          className={`bee-wing-right-${wingAnimation}`}
          cx="78"
          cy="55"
          rx="11"
          ry="20"
          fill={colors.wing}
          opacity="0.5"
          style={{ transformOrigin: '65px 60px', animationDelay: '0.1s' }}
        />

        {/* HEAD - Small yellow circle at top */}
        <circle cx="50" cy="18" r="8" fill={colors.highlight} />

        {/* HEAD STRIPE - Dark band on head */}
        <ellipse cx="50" cy="19" rx="8" ry="2.5" fill={colors.secondary} opacity="0.7" />

        {/* EYES - Large expressive eyes */}
        <circle cx="45" cy="16" r="2" fill={colors.text} />
        <circle cx="55" cy="16" r="2" fill={colors.text} />

        {/* EYE SHINE - Highlights */}
        <circle cx="45.5" cy="15" r="0.7" fill={colors.highlight} />
        <circle cx="55.5" cy="15" r="0.7" fill={colors.highlight} />

        {/* SMILE - Small curved smile */}
        <path
          d="M 47 19 Q 50 21 53 19"
          stroke={colors.text}
          strokeWidth="0.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* THORAX - Yellow-gold middle section */}
        <ellipse
          cx="50"
          cy="32"
          rx="11"
          ry="9"
          fill={colors.highlight}
        />

        {/* THORAX STRIPE - Dark band separator */}
        <ellipse cx="50" cy="40" rx="11" ry="1.5" fill={colors.secondary} opacity="0.8" />

        {/* ABDOMEN SEGMENT 1 - Purple/Dark blue stripe */}
        <ellipse
          cx="50"
          cy="48"
          rx="10"
          ry="8"
          fill={colors.secondary}
        />

        {/* ABDOMEN STRIPE SEPARATOR 1 */}
        <ellipse cx="50" cy="55.5" rx="10" ry="1.2" fill={colors.text} opacity="0.7" />

        {/* ABDOMEN SEGMENT 2 - Gold/yellow stripe */}
        <ellipse
          cx="50"
          cy="63"
          rx="9.5"
          ry="8"
          fill={colors.accent}
        />

        {/* ABDOMEN STRIPE SEPARATOR 2 */}
        <ellipse cx="50" cy="70" rx="9.5" ry="1.2" fill={colors.text} opacity="0.7" />

        {/* ABDOMEN SEGMENT 3 - Purple/Dark blue stripe (tapered) */}
        <ellipse
          cx="50"
          cy="77"
          rx="8.5"
          ry="7"
          fill={colors.secondary}
        />

        {/* STINGER - Small sharp point */}
        <path
          d="M 48 83 L 50 92 L 52 83 Z"
          fill={colors.text}
          opacity="0.9"
        />

        {/* HIGHLIGHT ON THORAX - Shine effect */}
        <ellipse cx="50" cy="30" rx="4" ry="2.5" fill={colors.highlight} opacity="0.3" />
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
