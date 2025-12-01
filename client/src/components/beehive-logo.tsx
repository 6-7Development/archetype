/**
 * BeeHive Logo - Hexagon Honeycomb with Animated Buzzing Bees
 * Central hive comb with small bees orbiting around
 * Uses brand colors (Honey, Nectar, Mint, Charcoal)
 * 
 * Bee animations are defined in index.css for easy customization
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
    hive: 'hsl(40, 97%, 48%)',
  },
  dark: {
    text: 'hsl(47, 100%, 95%)',
    accent: 'hsl(40, 97%, 50%)',
    highlight: 'hsl(48, 100%, 65%)',
    hive: 'hsl(40, 97%, 50%)',
  },
  light: {
    text: 'hsl(40, 97%, 50%)',
    accent: 'hsl(171, 100%, 42%)',
    highlight: 'hsl(48, 100%, 65%)',
    hive: 'hsl(40, 97%, 50%)',
  },
};

export function BeeHiveLogo({ 
  size = 'md', 
  className = '', 
  showText = true, 
  variant = 'primary', 
  iconSize, 
  textHeight,
}: BeeHiveLogoProps) {
  const svgSize = iconSize || SIZE_MAP[size];
  const textSize = textHeight ? `${textHeight}px` : SIZE_TEXT[size];
  const colors = VARIANT_COLORS[variant];

  // Generate bee positions around the hive (8 bees in orbit)
  const beeCount = 8;
  const beePositions = Array.from({ length: beeCount }, (_, i) => ({
    angle: (i / beeCount) * 360,
    delay: i * 0.1,
  }));

  return (
    <div className={`inline-flex items-center ${showText ? 'gap-3' : ''} ${className}`}>
      {/* Honeycomb Hive with Buzzing Bees */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        className="beehive-container"
      >
        {/* CENTRAL HEXAGON HONEYCOMB - Main hive */}
        <defs>
          <radialGradient id="hiveGlow" cx="50%" cy="50%">
            <stop offset="0%" stopColor={colors.highlight} />
            <stop offset="100%" stopColor={colors.hive} />
          </radialGradient>
        </defs>

        {/* Outer hexagon hive border */}
        <path
          d="M 50 15 L 72 27 L 72 51 L 50 63 L 28 51 L 28 27 Z"
          fill="url(#hiveGlow)"
          stroke={colors.accent}
          strokeWidth="1.5"
          opacity="0.9"
        />

        {/* Inner hexagon pattern (honeycomb cells) */}
        <g stroke={colors.accent} strokeWidth="0.8" fill="none" opacity="0.5">
          {/* Center hexagon */}
          <path d="M 42 35 L 50 30 L 58 35 L 58 45 L 50 50 L 42 45 Z" />
          
          {/* Top hexagons */}
          <path d="M 34 30 L 42 25 L 50 30 L 42 35 L 34 35 Z" />
          <path d="M 50 30 L 58 25 L 66 30 L 58 35 L 50 35 Z" />
          
          {/* Bottom hexagons */}
          <path d="M 34 45 L 42 50 L 50 55 L 42 60 L 34 55 Z" />
          <path d="M 50 45 L 58 50 L 66 55 L 58 60 L 50 55 Z" />
        </g>

        {/* Center glow effect */}
        <circle cx="50" cy="39" r="8" fill={colors.highlight} opacity="0.3" />

        {/* Orbit circles (invisible reference for bee movement) */}
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke={colors.accent}
          strokeWidth="0.3"
          opacity="0.1"
        />

        {/* ANIMATED BUZZING BEES - 8 bees orbiting */}
        {beePositions.map((pos, idx) => (
          <g
            key={idx}
            className={`buzzing-bee bee-orbit-${idx}`}
            style={{ animationDelay: `${pos.delay}s` }}
          >
            {/* Bee body */}
            <g transform={`rotate(${pos.angle} 50 50) translate(88 50)`}>
              {/* Bee head - small yellow circle */}
              <circle cx="2" cy="0" r="1.2" fill={colors.highlight} />

              {/* Bee body - tiny gold ellipse */}
              <ellipse cx="0" cy="0" rx="1" ry="1.8" fill={colors.accent} />

              {/* Bee wings - small curved wings */}
              <ellipse
                cx="-1.5"
                cy="-0.8"
                rx="0.6"
                ry="1.2"
                fill={colors.highlight}
                opacity="0.6"
              />
              <ellipse
                cx="1.5"
                cy="-0.8"
                rx="0.6"
                ry="1.2"
                fill={colors.highlight}
                opacity="0.6"
              />
            </g>
          </g>
        ))}
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
