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
  sm: 80,
  md: 140,
  lg: 200,
  xl: 280,
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
        viewBox="0 0 200 200"
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
          d="M 100 30 L 144 54 L 144 102 L 100 126 L 56 102 L 56 54 Z"
          fill="url(#hiveGlow)"
          stroke={colors.accent}
          strokeWidth="3"
          opacity="0.9"
        />

        {/* Inner hexagon pattern (honeycomb cells) */}
        <g stroke={colors.accent} strokeWidth="1.6" fill="none" opacity="0.5">
          {/* Center hexagon */}
          <path d="M 84 70 L 100 60 L 116 70 L 116 90 L 100 100 L 84 90 Z" />
          
          {/* Top hexagons */}
          <path d="M 68 60 L 84 50 L 100 60 L 84 70 L 68 70 Z" />
          <path d="M 100 60 L 116 50 L 132 60 L 116 70 L 100 70 Z" />
          
          {/* Bottom hexagons */}
          <path d="M 68 90 L 84 100 L 100 110 L 84 120 L 68 110 Z" />
          <path d="M 100 90 L 116 100 L 132 110 L 116 120 L 100 110 Z" />
        </g>

        {/* Center glow effect */}
        <circle cx="100" cy="78" r="16" fill={colors.highlight} opacity="0.3" />

        {/* Orbit circles (invisible reference for bee movement) */}
        <circle
          cx="100"
          cy="100"
          r="76"
          fill="none"
          stroke={colors.accent}
          strokeWidth="0.6"
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
            <g transform={`rotate(${pos.angle} 100 100) translate(176 100)`}>
              {/* Bee head - small yellow circle */}
              <circle cx="4" cy="0" r="2.4" fill={colors.highlight} />

              {/* Bee body - tiny gold ellipse */}
              <ellipse cx="0" cy="0" rx="2" ry="3.6" fill={colors.accent} />

              {/* Bee wings - small curved wings */}
              <ellipse
                cx="-3"
                cy="-1.6"
                rx="1.2"
                ry="2.4"
                fill={colors.highlight}
                opacity="0.6"
              />
              <ellipse
                cx="3"
                cy="-1.6"
                rx="1.2"
                ry="2.4"
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
