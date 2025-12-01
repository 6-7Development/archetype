/**
 * BeeHive Logo Component
 * Professional marketing bee with realistic anatomy + elegant "BeeHive" wordmark
 * Designed for excellent contrast on light (cream/tan) backgrounds
 * Scout emotional states: idle (charcoal), thinking (blue), working (purple), complete (mint)
 */

interface BeeHiveLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'icon-only' | 'with-text' | 'stacked';
  className?: string;
  isWorking?: boolean;
  emotion?: 'idle' | 'working' | 'thinking' | 'complete';
}

export function BeeHiveLogo({
  size = 'md',
  showText = true,
  variant = 'with-text',
  className = '',
  isWorking = false,
  emotion = 'idle',
}: BeeHiveLogoProps) {
  // Size presets
  const sizeMap = {
    sm: { svg: 44, text: '18px' },
    md: { svg: 56, text: '28px' },
    lg: { svg: 80, text: '42px' },
  };

  const dims = sizeMap[size] || sizeMap.md;
  const svgSize = dims.svg;
  const textSize = dims.text;

  // Color palette - optimized for light backgrounds
  const charcoalColor = '#1B1D21'; // Deep charcoal for main body (excellent contrast on tan/cream)
  const honeyGold = '#D4A017'; // Rich gold for accents (deeper than before)
  const mintColor = '#00D4B3'; // Vibrant mint for highlights
  const purpleColor = '#9333EA'; // Rich purple for working state
  const blueColor = '#2563EB'; // Deep blue for thinking state
  const creamBg = '#FFF8E6'; // Reference for light backgrounds

  // Get bee body color based on emotion
  const beeBodyColor =
    isWorking || emotion === 'working' ? purpleColor :
    emotion === 'thinking' ? blueColor :
    emotion === 'complete' ? mintColor :
    charcoalColor;

  // Stripe accent color (contrasts well with body)
  const stripeColor = emotion === 'complete' ? charcoalColor : honeyGold;

  return (
    <div className={`inline-flex items-center ${variant === 'stacked' ? 'flex-col' : 'gap-4'} ${className}`}>
      {/* Professional Bee SVG - Marketing Quality */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 120 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="beeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={beeBodyColor} stopOpacity="1" />
            <stop offset="100%" stopColor={beeBodyColor} stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="wingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={mintColor} stopOpacity="0.7" />
            <stop offset="100%" stopColor={mintColor} stopOpacity="0.3" />
          </linearGradient>
        </defs>

        <style>{`
          @keyframes bee-hover { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-3px); } }
          @keyframes wing-beat { 0%, 100% { transform: scaleY(1) rotateZ(-15deg); opacity: 0.7; } 50% { transform: scaleY(0.6) rotateZ(15deg); opacity: 1; } }
          .bee-container { ${isWorking ? 'animation: bee-hover 1.6s ease-in-out infinite;' : ''} }
          .bee-wings { ${isWorking ? 'animation: wing-beat 0.35s ease-in-out infinite;' : 'opacity: 0.65;'} transform-origin: center; }
        `}</style>

        <g className="bee-container">
          {/* LEFT WING */}
          <g className="bee-wings" style={{ transformOrigin: '55px 50px' }}>
            <ellipse cx="35" cy="50" rx="14" ry="22" fill="url(#wingGradient)" style={{ transition: 'opacity 0.3s ease' }} />
            {/* Wing vein detail */}
            <path d="M 35 35 L 35 65 M 25 50 L 45 50" stroke={mintColor} strokeWidth="0.8" opacity="0.4" />
          </g>

          {/* RIGHT WING */}
          <g className="bee-wings" style={{ transformOrigin: '65px 50px' }}>
            <ellipse cx="85" cy="50" rx="14" ry="22" fill="url(#wingGradient)" style={{ transition: 'opacity 0.3s ease' }} />
            {/* Wing vein detail */}
            <path d="M 85 35 L 85 65 M 75 50 L 95 50" stroke={mintColor} strokeWidth="0.8" opacity="0.4" />
          </g>

          {/* HEAD - Golden yellow with dark details */}
          <circle cx="60" cy="28" r="8" fill={beeBodyColor} style={{ transition: 'fill 0.3s ease' }} />
          {/* Head shine */}
          <circle cx="62" cy="26" r="2.5" fill={stripeColor} opacity="0.6" />
          {/* Eyes - large and prominent */}
          <circle cx="56" cy="26" r="2" fill={charcoalColor} />
          <circle cx="64" cy="26" r="2" fill={charcoalColor} />
          {/* Mouth/mandible detail */}
          <path d="M 60 32 Q 58 34 60 35 Q 62 34 60 32" fill={stripeColor} opacity="0.7" />

          {/* ANTENNAE - Elegant curves */}
          <g stroke={beeBodyColor} strokeWidth="1.5" fill="none" strokeLinecap="round" style={{ transition: 'stroke 0.3s ease' }}>
            <path d="M 56 22 Q 48 14 45 8" />
            <path d="M 64 22 Q 72 14 75 8" />
            {/* Antenna tips */}
            <circle cx="45" cy="8" r="1.2" fill={stripeColor} />
            <circle cx="75" cy="8" r="1.2" fill={stripeColor} />
          </g>

          {/* THORAX (middle segment) - Larger, with segmented look */}
          <ellipse cx="60" cy="55" rx="11" ry="15" fill={beeBodyColor} style={{ transition: 'fill 0.3s ease' }} />

          {/* Thorax stripes for dimension */}
          <g fill={stripeColor} opacity="0.65">
            <rect x="50" y="48" width="20" height="2" rx="1" />
            <rect x="49" y="55" width="22" height="2" rx="1" />
            <rect x="50" y="62" width="20" height="2" rx="1" />
          </g>

          {/* LEGS (6 total - 3 pairs) */}
          <g stroke={charcoalColor} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.8">
            {/* Front legs - pair 1 */}
            <path d="M 51 50 L 30 42" />
            <path d="M 69 50 L 90 42" />
            {/* Middle legs - pair 2 */}
            <path d="M 50 57 L 24 62" />
            <path d="M 70 57 L 96 62" />
            {/* Back legs - pair 3 */}
            <path d="M 52 68 L 32 85" />
            <path d="M 68 68 L 88 85" />
          </g>

          {/* ABDOMEN (lower segment with dramatic stripes) */}
          <g>
            {/* Main abdomen shape - tapered */}
            <ellipse cx="60" cy="85" rx="9.5" ry="18" fill={beeBodyColor} style={{ transition: 'fill 0.3s ease' }} />
            
            {/* Abdomen segments - bold stripes for visual impact */}
            <g fill={stripeColor} opacity="0.75">
              <rect x="51" y="72" width="18" height="2.5" rx="1" />
              <rect x="50.5" y="80" width="19" height="2.5" rx="1" />
              <rect x="51" y="88" width="18" height="2.5" rx="1" />
              <rect x="52" y="96" width="16" height="2.5" rx="1" />
            </g>
          </g>

          {/* STINGER - Fine detail */}
          <g>
            <path d="M 60 102 L 60 110" stroke={charcoalColor} strokeWidth="1.2" strokeLinecap="round" />
            <polygon points="60,110 57,107 63,107" fill={charcoalColor} />
          </g>

          {/* Body shine/highlight for depth */}
          <ellipse cx="62" cy="48" rx="3" ry="5" fill={stripeColor} opacity="0.4" />
        </g>
      </svg>

      {/* Logo Text - Modern Wordmark */}
      {showText && variant !== 'icon-only' && (
        <span
          className="font-black tracking-tight leading-none"
          style={{
            fontSize: textSize,
            color: charcoalColor,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            letterSpacing: '-0.02em',
            fontWeight: 900,
          }}
        >
          BeeHive
        </span>
      )}
    </div>
  );
}

export default BeeHiveLogo;
