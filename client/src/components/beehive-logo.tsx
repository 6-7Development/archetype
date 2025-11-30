/**
 * BeeHive Logo Component with Animated Scout Bee
 * Shows emotional states while working (idle, thinking, working, complete)
 */

interface BeeHiveLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'icon-only' | 'with-text' | 'stacked';
  className?: string;
  isWorking?: boolean; // Show Scout working animation
  emotion?: 'idle' | 'working' | 'thinking' | 'complete'; // Emotional state
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
    sm: { hexagon: 48, icon: 28 },
    md: { hexagon: 64, icon: 38 },
    lg: { hexagon: 96, icon: 56 },
  };

  const dims = sizeMap[size] || sizeMap.md;
  const hexSize = dims.hexagon;
  const iconSize = dims.icon;

  // Color tokens from design system
  const honeyColor = '#F7B500'; // Honey gold
  const mintColor = '#00D4B3'; // Mint teal
  const charcoalColor = '#101113'; // Deep dark
  const nectarColor = '#FFD34D'; // Light gold
  const purpleColor = '#A855F7'; // Working state purple

  // Emotional state colors
  const stateColor = isWorking || emotion === 'working' ? purpleColor : emotion === 'thinking' ? '#3B82F6' : emotion === 'complete' ? mintColor : honeyColor;

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Hexagon with Animated Scout Bee */}
      <svg
        width={hexSize}
        height={hexSize}
        viewBox="0 0 64 74"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>{`
          @keyframes scout-bob { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-2px); } }
          @keyframes scout-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes scout-pulse-color { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
          .scout-bee { ${isWorking ? 'animation: scout-bob 1.5s ease-in-out infinite;' : ''} }
          .scout-wings { ${isWorking ? 'animation: scout-spin 0.6s linear infinite;' : 'animation: scout-pulse-color 2s ease-in-out infinite;'} }
        `}</style>

        {/* Hexagon outline */}
        <path
          d="M32 2L61.24 19.5V54.5L32 72L2.76 54.5V19.5L32 2Z"
          fill={emotion === 'complete' ? mintColor : honeyColor}
          stroke={charcoalColor}
          strokeWidth="2"
          style={{ transition: 'fill 0.3s ease' }}
        />

        {/* Inner hexagon background */}
        <path
          d="M32 8L57 24V60L32 66L7 60V24L32 8Z"
          fill={charcoalColor}
        />

        {/* Scout bee body - animated */}
        <g className="scout-bee">
          <circle cx="32" cy="28" r="8" fill={stateColor} style={{ transition: 'fill 0.3s ease' }} />
          <ellipse cx="32" cy="40" rx="6" ry="10" fill={stateColor} style={{ transition: 'fill 0.3s ease' }} />

          {/* Bee stripes */}
          <rect x="27" y="35" width="10" height="2" fill={charcoalColor} />
          <rect x="27" y="41" width="10" height="2" fill={charcoalColor} />

          {/* Bee antennae - wiggles when working */}
          <line x1="32" y1="20" x2="28" y2="14" stroke={stateColor} strokeWidth="2" strokeLinecap="round" style={{ transition: 'stroke 0.3s ease' }} />
          <line x1="32" y1="20" x2="36" y2="14" stroke={stateColor} strokeWidth="2" strokeLinecap="round" style={{ transition: 'stroke 0.3s ease' }} />
        </g>

        {/* Wings - dynamic based on state */}
        <g className="scout-wings">
          <ellipse cx="20" cy="38" rx="4" ry="8" fill={mintColor} opacity={isWorking ? 1 : 0.6} />
          <ellipse cx="44" cy="38" rx="4" ry="8" fill={mintColor} opacity={isWorking ? 1 : 0.6} />
        </g>
      </svg>

      {/* Logo Text */}
      {showText && variant !== 'icon-only' && (
        <div className={variant === 'stacked' ? 'flex flex-col' : 'flex items-center'}>
          <div className="flex items-baseline gap-0">
            {/* "Bee" in honey gold */}
            <span
              className="font-black leading-none"
              style={{
                fontSize: size === 'sm' ? '24px' : size === 'md' ? '36px' : '54px',
                color: honeyColor,
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              Bee
            </span>

            {/* "Hive" in honey gold with mint "i" */}
            <span
              className="font-black leading-none"
              style={{
                fontSize: size === 'sm' ? '24px' : size === 'md' ? '36px' : '54px',
                color: honeyColor,
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              H
            </span>

            {/* "i" in mint teal - CLEAN, no overlay */}
            <span
              className="font-black leading-none"
              style={{
                fontSize: size === 'sm' ? '24px' : size === 'md' ? '36px' : '54px',
                color: mintColor,
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              i
            </span>

            {/* "ve" in honey gold - CLEAN, no overlay */}
            <span
              className="font-black leading-none"
              style={{
                fontSize: size === 'sm' ? '24px' : size === 'md' ? '36px' : '54px',
                color: honeyColor,
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              ve
            </span>
          </div>

          {/* Optional tagline */}
          <span
            className="text-xs font-semibold tracking-widest"
            style={{
              color: mintColor,
              marginTop: size === 'sm' ? '2px' : '4px',
            }}
          >
            SWARM MODE
          </span>
        </div>
      )}
    </div>
  );
}

export default BeeHiveLogo;
