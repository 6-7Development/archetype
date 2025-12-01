/**
 * BeeHive Universal Queen Bee Logo
 * Single source of truth - clean, professional design
 * Uses brand colors (no hard-coding), proper wing animation
 */

interface BeeHiveLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
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

export function BeeHiveLogo({ size = 'md', className = '', showText = true }: BeeHiveLogoProps) {
  const svgSize = SIZE_MAP[size];
  const textSize = SIZE_TEXT[size];

  return (
    <div className={`inline-flex items-center ${showText ? 'gap-2' : ''} ${className}`}>
      {/* Queen Bee - Clean SVG */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 100 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* HEXAGON CELL - Decorative border */}
        <path
          d="M50 10 L72 22 L72 46 L50 58 L28 46 L28 22 Z"
          stroke="hsl(40, 97%, 50%)"
          strokeWidth="1"
          opacity="0.3"
        />

        {/* WINGS - LEFT */}
        <ellipse
          cx="25"
          cy="42"
          rx="12"
          ry="20"
          fill="hsl(171, 100%, 42%)"
          opacity="0.6"
          style={{
            animation: 'wing-flap 0.4s ease-in-out infinite',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />

        {/* WINGS - RIGHT */}
        <ellipse
          cx="75"
          cy="42"
          rx="12"
          ry="20"
          fill="hsl(171, 100%, 42%)"
          opacity="0.6"
          style={{
            animation: 'wing-flap 0.4s ease-in-out infinite 0.2s',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />

        {/* HEAD */}
        <circle cx="50" cy="28" r="8" fill="hsl(216, 9%, 7%)" />

        {/* CROWN - Royal mark on top of head */}
        <g fill="hsl(40, 97%, 50%)">
          <polygon points="48,22 50,18 52,22 51,24 49,24" />
          <circle cx="50" cy="18" r="1" fill="hsl(40, 97%, 50%)" />
        </g>

        {/* EYES */}
        <circle cx="47" cy="27" r="1.2" fill="white" />
        <circle cx="53" cy="27" r="1.2" fill="white" />

        {/* THORAX - Middle body segment */}
        <ellipse cx="50" cy="48" rx="10" ry="13" fill="hsl(40, 97%, 50%)" />

        {/* THORAX STRIPE */}
        <rect
          x="43"
          y="46"
          width="14"
          height="1"
          rx="0.5"
          fill="hsl(216, 9%, 7%)"
          opacity="0.7"
        />

        {/* LEGS - 6 total (3 pairs) */}
        <g stroke="hsl(216, 9%, 7%)" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8">
          {/* Front legs - out to sides */}
          <path d="M46 45 L28 32" />
          <path d="M54 45 L72 32" />
          {/* Middle legs - forward diagonal */}
          <path d="M45 52 L22 65" />
          <path d="M55 52 L78 65" />
          {/* Back legs - down */}
          <path d="M48 58 L28 80" />
          <path d="M52 58 L72 80" />
        </g>

        {/* ABDOMEN - Main body segment (lower, largest) */}
        <ellipse cx="50" cy="82" rx="9" ry="18" fill="hsl(40, 97%, 50%)" />

        {/* ABDOMEN STRIPES - Black bands for segmentation */}
        <g fill="hsl(216, 9%, 7%)" opacity="0.7">
          <rect x="44" y="66" width="12" height="1" rx="0.5" />
          <rect x="43" y="75" width="14" height="1" rx="0.5" />
          <rect x="44" y="84" width="12" height="1" rx="0.5" />
          <rect x="45" y="93" width="10" height="1" rx="0.5" />
        </g>

        {/* STINGER - Sharp elegant point */}
        <g>
          <line
            x1="50"
            y1="100"
            x2="50"
            y2="110"
            stroke="hsl(216, 9%, 7%)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <polygon points="50,110 47,104 53,104" fill="hsl(216, 9%, 7%)" />
        </g>

        {/* Wing animation */}
        <style>{`
          @keyframes wing-flap {
            0%, 100% {
              transform: scaleY(1) rotateZ(-8deg);
              opacity: 0.6;
            }
            50% {
              transform: scaleY(0.7) rotateZ(8deg);
              opacity: 0.8;
            }
          }
        `}</style>
      </svg>

      {/* BeeHive Wordmark */}
      {showText && (
        <span
          style={{
            fontSize: textSize,
            fontWeight: 800,
            color: 'hsl(216, 9%, 7%)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
          }}
        >
          BeeHive
        </span>
      )}
    </div>
  );
}

export default BeeHiveLogo;
