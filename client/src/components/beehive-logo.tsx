/**
 * BeeHive Logo Component
 * Clean, editable SVG-based logo without overlay artifacts
 * Easy to customize colors, text, sizing
 */

interface BeeHiveLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'icon-only' | 'with-text' | 'stacked';
  className?: string;
}

export function BeeHiveLogo({
  size = 'md',
  showText = true,
  variant = 'with-text',
  className = '',
}: BeeHiveLogoProps) {
  // Size presets
  const sizeMap = {
    sm: { hexagon: 48, icon: 28 },
    md: { hexagon: 64, icon: 38 },
    lg: { hexagon: 96, icon: 56 },
  };

  const dims = sizeMap[size];
  const hexSize = dims.hexagon;
  const iconSize = dims.icon;

  // Color tokens from design system
  const honeyColor = '#F7B500'; // Honey gold
  const mintColor = '#00D4B3'; // Mint teal
  const charcoalColor = '#101113'; // Deep dark
  const nectarColor = '#FFD34D'; // Light gold

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Hexagon with Bee Icon */}
      <svg
        width={hexSize}
        height={hexSize}
        viewBox="0 0 64 74"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Hexagon outline */}
        <path
          d="M32 2L61.24 19.5V54.5L32 72L2.76 54.5V19.5L32 2Z"
          fill={honeyColor}
          stroke={charcoalColor}
          strokeWidth="2"
        />

        {/* Inner hexagon background */}
        <path
          d="M32 8L57 24V60L32 66L7 60V24L32 8Z"
          fill={charcoalColor}
        />

        {/* Bee body - simple, clean */}
        <circle cx="32" cy="28" r="8" fill={honeyColor} />
        <ellipse cx="32" cy="40" rx="6" ry="10" fill={honeyColor} />

        {/* Bee stripes */}
        <rect x="27" y="35" width="10" height="2" fill={charcoalColor} />
        <rect x="27" y="41" width="10" height="2" fill={charcoalColor} />

        {/* Bee antennae */}
        <line x1="32" y1="20" x2="28" y2="14" stroke={honeyColor} strokeWidth="2" strokeLinecap="round" />
        <line x1="32" y1="20" x2="36" y2="14" stroke={honeyColor} strokeWidth="2" strokeLinecap="round" />

        {/* Wings - subtle */}
        <ellipse cx="20" cy="38" rx="4" ry="8" fill={mintColor} opacity="0.6" />
        <ellipse cx="44" cy="38" rx="4" ry="8" fill={mintColor} opacity="0.6" />
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
