/**
 * BeeHive Universal Logo Component
 * 
 * Queen Bee in Hexagon Design - Works everywhere (nav, hero, favicon)
 * Professional, catchy, fresh design that impresses on all screens
 * Single source of truth for BeeHive branding
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
  sm: '16px',
  md: '24px',
  lg: '36px',
  xl: '48px',
};

export function BeeHiveLogo({ size = 'md', className = '', showText = true }: BeeHiveLogoProps) {
  const svgSize = SIZE_MAP[size];
  const textSize = SIZE_TEXT[size];

  return (
    <div className={`inline-flex items-center ${showText ? 'gap-3' : ''} ${className}`} style={{ alignItems: 'center' }}>
      {/* Queen Bee in Hexagon - SVG */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 120 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="queenBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F7B500" stopOpacity="1" />
            <stop offset="100%" stopColor="#D4A017" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="wingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00D4B3" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00D4B3" stopOpacity="0.2" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Hexagon Beehive Cell Background */}
        <path
          d="M60 10 L90 25 L90 55 L60 70 L30 55 L30 25 Z"
          fill="none"
          stroke="#D4A017"
          strokeWidth="1.5"
          opacity="0.4"
        />

        {/* WINGS - Large, translucent, diagonal */}
        <g opacity="0.7">
          {/* Left Wing */}
          <ellipse
            cx="35"
            cy="45"
            rx="16"
            ry="28"
            fill="url(#wingGrad)"
            transform="rotate(-35 35 45)"
            style={{ animation: 'wing-beat 0.4s ease-in-out infinite' }}
          />
          {/* Right Wing */}
          <ellipse
            cx="85"
            cy="45"
            rx="16"
            ry="28"
            fill="url(#wingGrad)"
            transform="rotate(35 85 45)"
            style={{ animation: 'wing-beat 0.4s ease-in-out infinite 0.2s' }}
          />
        </g>

        {/* HEAD - Royal Blue for Queen */}
        <circle cx="60" cy="32" r="10" fill="#1B1D21" />
        
        {/* Crown/Royal Mark - Small gold crown on head */}
        <g>
          <path d="M55 28 L56 24 L58 24 L60 22 L62 24 L64 24 L65 28" stroke="#F7B500" strokeWidth="1" fill="none" />
          <circle cx="60" cy="22" r="1.5" fill="#F7B500" />
        </g>

        {/* Eyes - Bright & alert */}
        <circle cx="57" cy="31" r="1.5" fill="#FFF" />
        <circle cx="63" cy="31" r="1.5" fill="#FFF" />

        {/* THORAX (Middle - Worker Bee Area) */}
        <ellipse cx="60" cy="55" rx="13" ry="16" fill="url(#queenBodyGrad)" />

        {/* Thorax Stripes - Gold bands */}
        <g fill="#1B1D21" opacity="0.6">
          <rect x="50" y="50" width="20" height="1.5" rx="0.5" />
          <rect x="49" y="56" width="22" height="1.5" rx="0.5" />
          <rect x="50" y="62" width="20" height="1.5" rx="0.5" />
        </g>

        {/* LEGS (6 total - 3 pairs, visible and dimensional) */}
        <g stroke="#1B1D21" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.8">
          {/* Front legs - angled out */}
          <path d="M54 52 L38 42" />
          <path d="M66 52 L82 42" />
          {/* Middle legs - forward */}
          <path d="M53 60 L28 68" />
          <path d="M67 60 L92 68" />
          {/* Back legs - down */}
          <path d="M55 68 L36 88" />
          <path d="M65 68 L84 88" />
        </g>

        {/* ABDOMEN (Lower - Largest, with prominent stripes) */}
        <g>
          {/* Main abdomen - Tapered rounded */}
          <ellipse cx="60" cy="95" rx="11" ry="20" fill="url(#queenBodyGrad)" />

          {/* Abdomen Stripes - Bold gold/black bands */}
          <g fill="#1B1D21" opacity="0.7">
            <rect x="50" y="78" width="20" height="2" rx="1" />
            <rect x="49" y="88" width="22" height="2" rx="1" />
            <rect x="50" y="98" width="20" height="2" rx="1" />
            <rect x="51" y="108" width="18" height="2" rx="1" />
          </g>
        </g>

        {/* STINGER - Elegant point */}
        <g>
          <path d="M60 115 L60 125" stroke="#1B1D21" strokeWidth="1.2" strokeLinecap="round" />
          <polygon points="60,125 57,120 63,120" fill="#1B1D21" />
        </g>

        {/* Royal Glow Effect */}
        <circle cx="60" cy="55" r="25" fill="url(#queenBodyGrad)" opacity="0.1" filter="url(#glow)" />

        {/* Animation Styles */}
        <style>{`
          @keyframes wing-beat {
            0%, 100% { transform: scaleY(1) rotateZ(-35deg); opacity: 0.7; }
            50% { transform: scaleY(0.5) rotateZ(35deg); opacity: 1; }
          }
        `}</style>
      </svg>

      {/* BeeHive Text Wordmark */}
      {showText && (
        <span
          style={{
            fontSize: textSize,
            fontWeight: 900,
            color: '#1B1D21',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          BeeHive
        </span>
      )}
    </div>
  );
}

export default BeeHiveLogo;
