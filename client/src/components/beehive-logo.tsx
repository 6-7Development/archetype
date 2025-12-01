/**
 * BeeHive Queen Bee Logo - Realistic Bee Design
 * Authentic bee anatomy with animated wings via universal CSS animations
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
  const wingGradId = `wingGrad-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`inline-flex items-center ${showText ? 'gap-3' : ''} ${className}`}>
      {/* Queen Bee - Realistic Design with Striped Body */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 100 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        className="bee-wing"
      >
        <defs>
          <linearGradient id={wingGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.highlight} stopOpacity="0.6" />
            <stop offset="100%" stopColor={colors.accent} stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* ANTENNAE - Curved antenna for realistic bee */}
        <path
          d="M 45 12 Q 40 8 38 2"
          stroke={colors.text}
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 55 12 Q 60 8 62 2"
          stroke={colors.text}
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
        {/* Antenna tips */}
        <circle cx="38" cy="2" r="0.8" fill={colors.text} />
        <circle cx="62" cy="2" r="0.8" fill={colors.text} />

        {/* HEAD - Small dark head */}
        <circle cx="50" cy="22" r="6" fill={colors.text} />

        {/* EYES - Large compound eyes */}
        <circle cx="46" cy="20" r="1.5" fill={colors.highlight} />
        <circle cx="54" cy="20" r="1.5" fill={colors.highlight} />

        {/* MOUTH - Small marking */}
        <ellipse cx="50" cy="24" rx="2" ry="1.2" fill={colors.accent} opacity="0.7" />

        {/* THORAX - Compact middle section (where legs attach) */}
        <ellipse cx="50" cy="36" rx="9" ry="11" fill={colors.text} />

        {/* LEGS - Realistic 6 legs attached to thorax */}
        <g stroke={colors.text} strokeWidth="1" fill="none" strokeLinecap="round">
          {/* Front left leg */}
          <path d="M 44 32 L 28 25" />
          <circle cx="28" cy="25" r="0.5" fill={colors.text} />
          
          {/* Front right leg */}
          <path d="M 56 32 L 72 25" />
          <circle cx="72" cy="25" r="0.5" fill={colors.text} />
          
          {/* Middle left leg */}
          <path d="M 43 37 L 18 38" />
          <circle cx="18" cy="38" r="0.5" fill={colors.text} />
          
          {/* Middle right leg */}
          <path d="M 57 37 L 82 38" />
          <circle cx="82" cy="38" r="0.5" fill={colors.text} />
          
          {/* Back left leg */}
          <path d="M 44 44 L 25 55" />
          <circle cx="25" cy="55" r="0.5" fill={colors.text} />
          
          {/* Back right leg */}
          <path d="M 56 44 L 75 55" />
          <circle cx="75" cy="55" r="0.5" fill={colors.text} />
        </g>

        {/* LEFT WING - Realistic wing shape with animation */}
        <g className={`bee-wing-left-${wingAnimation}`}>
          <path
            d="M 38 28 Q 25 15 20 35 Q 22 50 35 48 Q 40 35 38 28"
            fill={`url(#${wingGradId})`}
            stroke={colors.accent}
            strokeWidth="0.5"
            opacity="0.8"
          />
          {/* Wing venation detail */}
          <path d="M 30 28 Q 28 35 32 42" stroke={colors.accent} strokeWidth="0.3" opacity="0.4" fill="none" />
          <path d="M 35 25 Q 33 35 36 45" stroke={colors.accent} strokeWidth="0.3" opacity="0.4" fill="none" />
        </g>

        {/* RIGHT WING - Realistic wing shape with animation */}
        <g className={`bee-wing-right-${wingAnimation}`}>
          <path
            d="M 62 28 Q 75 15 80 35 Q 78 50 65 48 Q 60 35 62 28"
            fill={`url(#${wingGradId})`}
            stroke={colors.accent}
            strokeWidth="0.5"
            opacity="0.8"
          />
          {/* Wing venation detail */}
          <path d="M 70 28 Q 72 35 68 42" stroke={colors.accent} strokeWidth="0.3" opacity="0.4" fill="none" />
          <path d="M 65 25 Q 67 35 64 45" stroke={colors.accent} strokeWidth="0.3" opacity="0.4" fill="none" />
        </g>

        {/* ABDOMEN - Striped body segments (classic bee look!) */}
        
        {/* Stripe 1 - Yellow (nectar) */}
        <ellipse
          cx="50"
          cy="62"
          rx="8.5"
          ry="8"
          fill={colors.highlight}
        />

        {/* Stripe 1 divider line */}
        <line x1="42" y1="70" x2="58" y2="70" stroke={colors.text} strokeWidth="0.8" opacity="0.6" />

        {/* Stripe 2 - Gold (honey) */}
        <ellipse
          cx="50"
          cy="79"
          rx="8"
          ry="8"
          fill={colors.accent}
        />

        {/* Stripe 2 divider line */}
        <line x1="42" y1="87" x2="58" y2="87" stroke={colors.text} strokeWidth="0.8" opacity="0.6" />

        {/* Stripe 3 - Yellow (nectar) */}
        <ellipse
          cx="50"
          cy="96"
          rx="7.5"
          ry="8"
          fill={colors.highlight}
        />

        {/* Stripe 3 divider line */}
        <line x1="43" y1="104" x2="57" y2="104" stroke={colors.text} strokeWidth="0.8" opacity="0.6" />

        {/* Stripe 4 - Gold (honey) */}
        <ellipse
          cx="50"
          cy="112"
          rx="7"
          ry="7"
          fill={colors.accent}
        />

        {/* STINGER - Sharp point at end of abdomen */}
        <path
          d="M 48 119 L 50 128 L 52 119"
          fill={colors.text}
          stroke={colors.text}
          strokeWidth="0.5"
        />

        {/* Black stripe on abdomen for realism */}
        <ellipse
          cx="50"
          cy="62"
          rx="8.5"
          ry="1.2"
          fill={colors.text}
          opacity="0.8"
        />
        <ellipse
          cx="50"
          cy="79"
          rx="8"
          ry="1.2"
          fill={colors.text}
          opacity="0.8"
        />
        <ellipse
          cx="50"
          cy="96"
          rx="7.5"
          ry="1.2"
          fill={colors.text}
          opacity="0.8"
        />
        <ellipse
          cx="50"
          cy="112"
          rx="7"
          ry="1.2"
          fill={colors.text}
          opacity="0.8"
        />
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
