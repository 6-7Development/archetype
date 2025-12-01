/**
 * BeeHive Logo Component
 * Professional bee illustration with proper anatomy + elegant typography
 * Scout emotional states: idle (gold), thinking (blue), working (purple), complete (mint)
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
  // Size presets for SVG
  const sizeMap = {
    sm: { svg: 40, text: '16px' },
    md: { svg: 56, text: '28px' },
    lg: { svg: 80, text: '42px' },
  };

  const dims = sizeMap[size] || sizeMap.md;
  const svgSize = dims.svg;
  const textSize = dims.text;

  // Color tokens from design system
  const honeyColor = '#F7B500'; // Honey gold
  const mintColor = '#00D4B3'; // Mint teal
  const charcoalColor = '#101113'; // Deep dark
  const graphiteColor = '#1B1D21'; // Slightly lighter dark
  const purpleColor = '#A855F7'; // Working state purple
  const blueColor = '#3B82F6'; // Thinking state

  // Emotional state bee color
  const beeColor = 
    isWorking || emotion === 'working' ? purpleColor : 
    emotion === 'thinking' ? blueColor : 
    emotion === 'complete' ? mintColor : 
    honeyColor;

  return (
    <div className={`inline-flex items-center ${variant === 'stacked' ? 'flex-col' : 'gap-3'} ${className}`}>
      {/* Professional Bee SVG with Full Anatomy */}
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <style>{`
          @keyframes bee-bob { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-1px); } }
          @keyframes bee-wing-flap { 0%, 100% { transform: scaleY(0.8); opacity: 0.9; } 50% { transform: scaleY(1); opacity: 1; } }
          .bee-body { ${isWorking ? 'animation: bee-bob 1.5s ease-in-out infinite;' : ''} }
          .bee-wings { ${isWorking ? 'animation: bee-wing-flap 0.3s ease-in-out infinite;' : ''} }
        `}</style>

        {/* Head */}
        <circle cx="50" cy="25" r="7" fill={beeColor} style={{ transition: 'fill 0.3s ease' }} />

        {/* Antennae */}
        <g stroke={beeColor} strokeWidth="1.2" strokeLinecap="round" style={{ transition: 'stroke 0.3s ease' }}>
          <path d="M 48 18 Q 44 12 42 8" fill="none" />
          <path d="M 52 18 Q 56 12 58 8" fill="none" />
        </g>

        {/* Eyes */}
        <circle cx="47" cy="23" r="1" fill={charcoalColor} />
        <circle cx="53" cy="23" r="1" fill={charcoalColor} />

        {/* Thorax (middle body segment) - animated */}
        <g className="bee-body">
          <ellipse cx="50" cy="42" rx="8" ry="11" fill={beeColor} style={{ transition: 'fill 0.3s ease' }} />

          {/* Thorax stripes for detail */}
          <rect x="44" y="38" width="12" height="1.5" fill={charcoalColor} opacity="0.6" />
          <rect x="44" y="43" width="12" height="1.5" fill={charcoalColor} opacity="0.6" />
        </g>

        {/* Upper Legs (attached to thorax - 3 pairs) */}
        <g stroke={graphiteColor} strokeWidth="1.2" strokeLinecap="round" fill="none">
          {/* Front left leg */}
          <path d="M 43 38 L 35 32" />
          {/* Front right leg */}
          <path d="M 57 38 L 65 32" />
          {/* Middle left leg */}
          <path d="M 42 43 L 32 45" />
          {/* Middle right leg */}
          <path d="M 58 43 L 68 45" />
        </g>

        {/* Abdomen (lower body segment with segments) - animated */}
        <g className="bee-body">
          {/* Main abdomen */}
          <ellipse cx="50" cy="62" rx="7" ry="14" fill={beeColor} style={{ transition: 'fill 0.3s ease' }} />

          {/* Abdominal stripes for realism */}
          <rect x="45" y="52" width="10" height="1.5" fill={charcoalColor} opacity="0.5" />
          <rect x="45" y="58" width="10" height="1.5" fill={charcoalColor} opacity="0.5" />
          <rect x="45" y="64" width="10" height="1.5" fill={charcoalColor} opacity="0.5" />
          <rect x="45" y="70" width="10" height="1.5" fill={charcoalColor} opacity="0.5" />
        </g>

        {/* Back Legs (attached to abdomen) */}
        <g stroke={graphiteColor} strokeWidth="1.2" strokeLinecap="round" fill="none">
          {/* Back left leg */}
          <path d="M 43 60 L 32 70" />
          {/* Back right leg */}
          <path d="M 57 60 L 68 70" />
        </g>

        {/* Wings - semi-transparent, animated */}
        <g className="bee-wings" style={{ transformOrigin: '50px 45px' }}>
          {/* Left wing */}
          <ellipse cx="35" cy="45" rx="6" ry="12" fill={mintColor} opacity="0.65" style={{ transition: 'opacity 0.3s ease' }} />
          {/* Right wing */}
          <ellipse cx="65" cy="45" rx="6" ry="12" fill={mintColor} opacity="0.65" style={{ transition: 'opacity 0.3s ease' }} />
        </g>

        {/* Wing detail lines for realism */}
        <g stroke={mintColor} strokeWidth="0.8" opacity="0.4" fill="none">
          <path d="M 35 35 L 35 55" />
          <path d="M 30 45 L 40 45" />
          <path d="M 65 35 L 65 55" />
          <path d="M 60 45 L 70 45" />
        </g>
      </svg>

      {/* Logo Text - Clean, Modern */}
      {showText && variant !== 'icon-only' && (
        <div className={variant === 'stacked' ? 'flex flex-col items-center gap-1' : 'flex items-baseline'}>
          {/* Main Text */}
          <span
            className="font-extrabold tracking-tight leading-none"
            style={{
              fontSize: textSize,
              color: honeyColor,
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '-0.015em',
            }}
          >
            BeeHive
          </span>

          {/* Tagline */}
          <span
            className="text-xs font-semibold tracking-widest"
            style={{
              color: mintColor,
              letterSpacing: '0.1em',
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
