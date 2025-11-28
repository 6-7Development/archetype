// ============================================================================
// ONE UNIVERSAL BEEHIVE AI LOGO - Tech-Enhanced with Buzzing Worker Bees
// ============================================================================

interface UniversalLogoProps {
  variant?: "full" | "icon"; // full = logo + text, icon = logo only
  size?: "sm" | "md" | "lg"; // sm=48px, md=160px, lg=400px
  className?: string;
}

// CSS Animations for Worker Bees - Swarming Effect
const workerBeeAnimationStyles = `
  @keyframes beeOrbit1 {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    25% { transform: translate(4px, -4px) rotate(10deg); }
    50% { transform: translate(0, -6px) rotate(0deg); }
    75% { transform: translate(-4px, -4px) rotate(-10deg); }
  }
  
  @keyframes beeOrbit2 {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    25% { transform: translate(-3px, -5px) rotate(-15deg); }
    50% { transform: translate(-6px, 0) rotate(0deg); }
    75% { transform: translate(-3px, 5px) rotate(15deg); }
  }
  
  @keyframes beeOrbit3 {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    25% { transform: translate(5px, 3px) rotate(8deg); }
    50% { transform: translate(0, 6px) rotate(0deg); }
    75% { transform: translate(-5px, 3px) rotate(-8deg); }
  }
  
  @keyframes wingFlap {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 0.9; }
  }
  
  .worker-bee-1 {
    animation: beeOrbit1 3.5s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center center;
  }
  
  .worker-bee-2 {
    animation: beeOrbit2 4s ease-in-out infinite 0.5s;
    transform-box: fill-box;
    transform-origin: center center;
  }
  
  .worker-bee-3 {
    animation: beeOrbit3 3.2s ease-in-out infinite 1s;
    transform-box: fill-box;
    transform-origin: center center;
  }
  
  .worker-wings {
    animation: wingFlap 0.3s ease-in-out infinite;
  }
  
  @media (prefers-reduced-motion: reduce) {
    .worker-bee-1, .worker-bee-2, .worker-bee-3, .worker-wings {
      animation: none;
    }
  }
`;

export function UniversalLogo({ variant = "full", size = "md", className = "" }: UniversalLogoProps) {
  const dimensions = {
    sm: { width: 120, height: 120, beeScale: 1.2, wordmarkSize: 0 },     // Footer - MUCH bigger
    md: { width: 200, height: 50, beeScale: 1.3, wordmarkSize: 22 },     // Mobile header - bigger
    lg: { width: 480, height: 120, beeScale: 2.2, wordmarkSize: 42 }     // Desktop header - BIGGER
  };

  const { width, height, beeScale, wordmarkSize } = dimensions[size];
  const showWordmark = variant === "full" && wordmarkSize > 0;
  const idPrefix = `logo-${variant}-${size}`;

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={showWordmark ? "0 0 400 100" : "0 0 100 100"}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Hexad"
    >
      <style>{workerBeeAnimationStyles}</style>
      <defs>
        {/* Shared Gradients */}
        <linearGradient id={`${idPrefix}-wing`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0F7FA" stopOpacity="0.3"/>
          <stop offset="50%" stopColor="#00D4B3" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#00B89E" stopOpacity="0.8"/>
        </linearGradient>
        <linearGradient id={`${idPrefix}-body`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFD34D"/>
          <stop offset="50%" stopColor="#F7B500"/>
          <stop offset="100%" stopColor="#E5943C"/>
        </linearGradient>
        
        {/* Enhanced Honey Gradient - Rich 3D effect */}
        <linearGradient id={`${idPrefix}-honey`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFE17D"/>
          <stop offset="30%" stopColor="#FFD34D"/>
          <stop offset="60%" stopColor="#F7B500"/>
          <stop offset="100%" stopColor="#D4940A"/>
        </linearGradient>
        
        {/* Honey Stroke Gradient - Dark outline */}
        <linearGradient id={`${idPrefix}-honey-stroke`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#B8860B"/>
          <stop offset="100%" stopColor="#8B6508"/>
        </linearGradient>
        
        <linearGradient id={`${idPrefix}-mint`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00D4B3"/>
          <stop offset="100%" stopColor="#00B89E"/>
        </linearGradient>
        
        {/* Tech Glow Filter */}
        <filter id={`${idPrefix}-glow`}>
          <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        {/* Text Glow Filter - Stronger for wordmark */}
        <filter id={`${idPrefix}-text-glow`}>
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <g transform={showWordmark ? "translate(0, 0)" : "translate(50, 50)"}>
        {/* Tech Hexagon Container with Animated Glow */}
        <g transform={showWordmark ? `translate(35, 50)` : `translate(0, 0)`}>
          {/* Outer Glow */}
          <path 
            d="M-28 0 L-14 -24 L14 -24 L28 0 L14 24 L-14 24 Z"
            fill="none"
            stroke="#00D4B3"
            strokeWidth="1"
            opacity="0.3"
            filter={`url(#${idPrefix}-glow)`}
          />
          
          {/* Main Hexagon with Tech Border */}
          <path 
            d="M-25 0 L-12.5 -21.7 L12.5 -21.7 L25 0 L12.5 21.7 L-12.5 21.7 Z"
            fill="#1a1a1a"
            stroke="#F7B500"
            strokeWidth="2"
            opacity="0.8"
          />
          
          {/* Inner Tech Lines */}
          <path d="M-20 -11.5 L-10 -17.3" stroke="#00D4B3" strokeWidth="1.5" opacity="0.6"/>
          <path d="M20 -11.5 L10 -17.3" stroke="#00D4B3" strokeWidth="1.5" opacity="0.6"/>
          <path d="M-20 11.5 L-10 17.3" stroke="#FFD34D" strokeWidth="1.5" opacity="0.6"/>
          <path d="M20 11.5 L10 17.3" stroke="#FFD34D" strokeWidth="1.5" opacity="0.6"/>

          {/* MAIN TECH BEE - Center Stage */}
          <TechBee x={0} y={0} scale={beeScale} idPrefix={idPrefix} />

          {/* BUZZING WORKER BEES - MUCH LARGER & VISIBLE swarming around the Queen */}
          {size !== "sm" && (
            <g opacity="0.95">
              {/* Top Left Worker Bee - Flying patrol */}
              <g className="worker-bee-1">
                <WorkerBee x={-32} y={-28} scale={0.85} rotation={-20} idPrefix={`${idPrefix}-w1`} />
              </g>
              
              {/* Top Right Worker Bee - Flying patrol */}
              <g className="worker-bee-2">
                <WorkerBee x={32} y={-28} scale={0.85} rotation={20} idPrefix={`${idPrefix}-w2`} />
              </g>
              
              {/* Left Worker Bee - Side patrol */}
              <g className="worker-bee-4">
                <WorkerBee x={-38} y={0} scale={0.8} rotation={-45} idPrefix={`${idPrefix}-w4`} />
              </g>
              
              {/* Right Worker Bee - Side patrol */}
              <g className="worker-bee-5">
                <WorkerBee x={38} y={0} scale={0.8} rotation={45} idPrefix={`${idPrefix}-w5`} />
              </g>
              
              {/* Bottom Left Worker Bee - Lower patrol */}
              {size === "lg" && (
                <g className="worker-bee-6">
                  <WorkerBee x={-28} y={32} scale={0.75} rotation={-10} idPrefix={`${idPrefix}-w6`} />
                </g>
              )}
              
              {/* Bottom Right Worker Bee - Lower patrol */}
              {size === "lg" && (
                <g className="worker-bee-7">
                  <WorkerBee x={28} y={32} scale={0.75} rotation={10} idPrefix={`${idPrefix}-w7`} />
                </g>
              )}
            </g>
          )}
        </g>

        {/* Wordmark (Hexad AI) - DRAMATIC HONEYCOMB REDESIGN */}
        {showWordmark && (
          <g transform={size === "lg" ? "translate(75, 35)" : "translate(38, 15)"}>
            {/* HONEYCOMB PATTERN OVERLAY on letters */}
            <g opacity="0.25">
              {/* Hexagons in "B" */}
              <path d={size === "lg" ? "M8 18 L10 15 L12 15 L14 18 L12 21 L10 21 Z" : "M4 9 L5 7.5 L6 7.5 L7 9 L6 10.5 L5 10.5 Z"} stroke="#00D4B3" strokeWidth={size === "lg" ? "1.5" : "0.8"} fill="none"/>
              {/* Hexagons in "e" */}
              <path d={size === "lg" ? "M40 18 L42 15 L44 15 L46 18 L44 21 L42 21 Z" : "M20 9 L21 7.5 L22 7.5 L23 9 L22 10.5 L21 10.5 Z"} stroke="#FFD34D" strokeWidth={size === "lg" ? "1.5" : "0.8"} fill="none"/>
              {/* Hexagons in "h" */}
              <path d={size === "lg" ? "M60 18 L62 15 L64 15 L66 18 L64 21 L62 21 Z" : "M30 9 L31 7.5 L32 7.5 L33 9 L32 10.5 L31 10.5 Z"} stroke="#00D4B3" strokeWidth={size === "lg" ? "1.5" : "0.8"} fill="none"/>
              {/* Hexagons in "v" */}
              <path d={size === "lg" ? "M100 18 L102 15 L104 15 L106 18 L104 21 L102 21 Z" : "M50 9 L51 7.5 L52 7.5 L53 9 L52 10.5 L51 10.5 Z"} stroke="#FFD34D" strokeWidth={size === "lg" ? "1.5" : "0.8"} fill="none"/>
            </g>

            {/* HONEY DRIP effects on bottom */}
            <g opacity="0.6">
              <ellipse cx={size === "lg" ? "15" : "7.5"} cy={size === "lg" ? "48" : "24"} rx={size === "lg" ? "3" : "1.5"} ry={size === "lg" ? "5" : "2.5"} fill="#F7B500"/>
              <ellipse cx={size === "lg" ? "85" : "42.5"} cy={size === "lg" ? "48" : "24"} rx={size === "lg" ? "3" : "1.5"} ry={size === "lg" ? "5" : "2.5"} fill="#FFD34D"/>
              <ellipse cx={size === "lg" ? "155" : "77.5"} cy={size === "lg" ? "48" : "24"} rx={size === "lg" ? "3" : "1.5"} ry={size === "lg" ? "5" : "2.5"} fill="#F7B500"/>
            </g>

            {/* "Hexad" - BOLD stroke outline */}
            <text 
              x="0" 
              y="0" 
              fontSize={wordmarkSize} 
              fontFamily="Inter, system-ui, sans-serif" 
              fontWeight="900"
              stroke="#1B1D21"
              strokeWidth={size === "lg" ? "4" : "2"}
              fill="none"
              letterSpacing="-0.03em"
              dominantBaseline="hanging"
              strokeLinejoin="round"
            >
              Hexad
            </text>
            
            {/* "Hexad" - Secondary honey stroke */}
            <text 
              x="0" 
              y="0" 
              fontSize={wordmarkSize} 
              fontFamily="Inter, system-ui, sans-serif" 
              fontWeight="900"
              stroke={`url(#${idPrefix}-honey-stroke)`}
              strokeWidth={size === "lg" ? "2.5" : "1.5"}
              fill="none"
              letterSpacing="-0.03em"
              dominantBaseline="hanging"
            >
              Hexad
            </text>
            
            {/* "Hexad" - Main fill with RICH gradient */}
            <text 
              x="0" 
              y="0" 
              fontSize={wordmarkSize} 
              fontFamily="Inter, system-ui, sans-serif" 
              fontWeight="900"
              fill={`url(#${idPrefix}-honey)`}
              letterSpacing="-0.03em"
              dominantBaseline="hanging"
              filter={`url(#${idPrefix}-text-glow)`}
            >
              Hexad
            </text>
            
            {/* "Hexad" - TOP highlight for 3D shine */}
            <text 
              x="0" 
              y={size === "lg" ? "-2" : "-1"} 
              fontSize={wordmarkSize} 
              fontFamily="Inter, system-ui, sans-serif" 
              fontWeight="900"
              fill="#FFFFFF"
              fillOpacity="0.5"
              letterSpacing="-0.03em"
              dominantBaseline="hanging"
              style={{ mixBlendMode: 'overlay' }}
            >
              Hexad
            </text>
            
            {/* MINT EDGE ACCENTS on select letters */}
            <g opacity="0.7">
              <text 
                x={size === "lg" ? "48" : "24"} 
                y="0" 
                fontSize={wordmarkSize} 
                fontFamily="Inter, system-ui, sans-serif" 
                fontWeight="900"
                stroke="#00D4B3"
                strokeWidth={size === "lg" ? "1" : "0.5"}
                fill="none"
                letterSpacing="-0.03em"
                dominantBaseline="hanging"
              >
                e
              </text>
            </g>
            
            {/* "AI" - TIGHT superscript right next to E */}
            <text 
              x={size === "lg" ? "168" : "84"} 
              y={size === "lg" ? "-8" : "-4"} 
              fontSize={size === "lg" ? 20 : 10} 
              fontFamily="Inter, system-ui, sans-serif" 
              fontWeight="900"
              fill={`url(#${idPrefix}-mint)`}
              letterSpacing="-0.02em"
              filter={`url(#${idPrefix}-text-glow)`}
            >
              AI
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}

// ============================================================================
// TECH BEE - Main Character with Heavy Tech Enhancements
// ============================================================================
function TechBee({ x, y, scale, idPrefix }: { x: number; y: number; scale: number; idPrefix: string }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      {/* TECH WINGS with Circuit Boards */}
      <g opacity="0.95">
        {/* Left Wing with Circuits */}
        <ellipse cx="-6" cy="-2" rx="4.5" ry="3" fill={`url(#${idPrefix}-wing)`} transform="rotate(-15 -6 -2)"/>
        <ellipse cx="-5.5" cy="-1.5" rx="3.5" ry="2.2" fill="#00D4B3" opacity="0.5" transform="rotate(-15 -5.5 -1.5)"/>
        
        {/* Circuit Traces - THICK & VISIBLE */}
        <g transform="rotate(-15 -6 -2)" stroke="#FFD34D" strokeWidth="0.5" opacity="0.9" fill="none" filter={`url(#${idPrefix}-glow)`}>
          <path d="M-8 -2.5 L-6.5 -2.5 L-6 -2" strokeWidth="0.6"/>
          <path d="M-7.5 -1.5 L-6 -1.5" strokeWidth="0.6"/>
          <circle cx="-6.5" cy="-2.5" r="0.4" fill="#FFD34D" />
          <circle cx="-6" cy="-1.5" r="0.4" fill="#FFD34D" />
          <path d="M-7 -3 L-5.5 -3" stroke="#00D4B3" strokeWidth="0.4"/>
        </g>
        
        {/* Right Wing with Circuits */}
        <ellipse cx="6" cy="-2" rx="4.5" ry="3" fill={`url(#${idPrefix}-wing)`} transform="rotate(15 6 -2)"/>
        <ellipse cx="5.5" cy="-1.5" rx="3.5" ry="2.2" fill="#00D4B3" opacity="0.5" transform="rotate(15 5.5 -1.5)"/>
        
        {/* Circuit Traces - THICK & VISIBLE */}
        <g transform="rotate(15 6 -2)" stroke="#FFD34D" strokeWidth="0.5" opacity="0.9" fill="none" filter={`url(#${idPrefix}-glow)`}>
          <path d="M8 -2.5 L6.5 -2.5 L6 -2" strokeWidth="0.6"/>
          <path d="M7.5 -1.5 L6 -1.5" strokeWidth="0.6"/>
          <circle cx="6.5" cy="-2.5" r="0.4" fill="#FFD34D" />
          <circle cx="6" cy="-1.5" r="0.4" fill="#FFD34D" />
          <path d="M7 -3 L5.5 -3" stroke="#00D4B3" strokeWidth="0.4"/>
        </g>
      </g>
      
      {/* BODY with LARGE HEX TECH PANELS */}
      <ellipse cx="0" cy="1" rx="4.5" ry="6" fill="#1a1a1a"/>
      <ellipse cx="0" cy="1" rx="4" ry="5.5" fill={`url(#${idPrefix}-body)`}/>
      <ellipse cx="-1" cy="-1" rx="2" ry="3" fill="#FFD34D" opacity="0.4"/>
      
      {/* LARGE VISIBLE HEXAGON PANELS */}
      <g opacity="0.8" stroke="#00D4B3" strokeWidth="0.4" fill="none" filter={`url(#${idPrefix}-glow)`}>
        <path d="M-2.5 0 L-2 -0.6 L-1.5 -0.6 L-1 0 L-1.5 0.6 L-2 0.6 Z" />
        <path d="M1.5 0 L2 -0.6 L2.5 -0.6 L3 0 L2.5 0.6 L2 0.6 Z" />
        <path d="M-1 2.5 L-0.5 2 L0.5 2 L1 2.5 L0.5 3 L-0.5 3 Z" stroke="#FFD34D"/>
      </g>
      
      {/* LED STRIPES with BRIGHT GLOW */}
      <rect x="-4" y="-1" width="8" height="1.5" rx="0.4" fill="#1a1a1a"/>
      <rect x="-4" y="1.2" width="8" height="1.5" rx="0.4" fill="#1a1a1a"/>
      <rect x="-4" y="3.4" width="8" height="1.5" rx="0.4" fill="#1a1a1a"/>
      
      {/* BRIGHT LED HIGHLIGHTS */}
      <rect x="-3.5" y="-0.7" width="7" height="0.5" rx="0.2" fill="#00D4B3" opacity="0.8" filter={`url(#${idPrefix}-glow)`}/>
      <rect x="-3.5" y="1.5" width="7" height="0.5" rx="0.2" fill="#00D4B3" opacity="0.8" filter={`url(#${idPrefix}-glow)`}/>
      <rect x="-3.5" y="3.7" width="7" height="0.5" rx="0.2" fill="#FFD34D" opacity="0.7" filter={`url(#${idPrefix}-glow)`}/>
      
      {/* HEAD with DIGITAL EYES */}
      <circle cx="0" cy="-6" r="3" fill="#1a1a1a"/>
      <circle cx="0" cy="-6" r="2.5" fill={`url(#${idPrefix}-body)`}/>
      
      {/* DIGITAL EYES - Square/Tech Style */}
      <g>
        <rect x="-1.8" y="-7" width="1" height="1" rx="0.2" fill="#1a1a1a"/>
        <rect x="-1.7" y="-6.9" width="0.8" height="0.8" rx="0.1" fill="#00D4B3" opacity="0.9"/>
        <rect x="-1.5" y="-6.7" width="0.3" height="0.3" fill="#FFD34D"/>
        
        <rect x="0.8" y="-7" width="1" height="1" rx="0.2" fill="#1a1a1a"/>
        <rect x="0.9" y="-6.9" width="0.8" height="0.8" rx="0.1" fill="#00D4B3" opacity="0.9"/>
        <rect x="1.2" y="-6.7" width="0.3" height="0.3" fill="#FFD34D"/>
      </g>
      
      {/* TECH SMILE - Circuit Style */}
      <path d="M-1.5 -5.2 Q0 -4.5 1.5 -5.2" stroke="#00D4B3" strokeWidth="0.4" fill="none" strokeLinecap="round"/>
      
      {/* ANTENNAE with GLOWING SENSORS */}
      <g>
        <line x1="-1.5" y1="-9" x2="-2" y2="-11" stroke="#1a1a1a" strokeWidth="0.6"/>
        <line x1="-1.5" y1="-9" x2="-2" y2="-11" stroke={`url(#${idPrefix}-honey)`} strokeWidth="0.4"/>
        <circle cx="-2" cy="-11" r="0.6" fill="#FFD34D" filter={`url(#${idPrefix}-glow)`}/>
        <circle cx="-2" cy="-11" r="0.3" fill="#00D4B3"/>
        
        <line x1="1.5" y1="-9" x2="2" y2="-11" stroke="#1a1a1a" strokeWidth="0.6"/>
        <line x1="1.5" y1="-9" x2="2" y2="-11" stroke={`url(#${idPrefix}-honey)`} strokeWidth="0.4"/>
        <circle cx="2" cy="-11" r="0.6" fill="#FFD34D" filter={`url(#${idPrefix}-glow)`}/>
        <circle cx="2" cy="-11" r="0.3" fill="#00D4B3"/>
      </g>
      
      {/* CODE SYMBOLS - LARGE & VISIBLE */}
      <text x="-8" y="-6" fontSize="2" fill="#00D4B3" opacity="0.8" fontFamily="monospace" fontWeight="bold">&lt;/&gt;</text>
      <text x="5.5" y="-6" fontSize="2" fill="#FFD34D" opacity="0.8" fontFamily="monospace" fontWeight="bold">{'{}'}</text>
      <text x="-1" y="-10" fontSize="1.5" fill="#00D4B3" opacity="0.6" fontFamily="monospace">[  ]</text>
    </g>
  );
}

// ============================================================================
// WORKER BEE - Smaller helper bees buzzing around the hive
// ============================================================================
function WorkerBee({ x, y, scale, rotation, idPrefix }: { x: number; y: number; scale: number; rotation: number; idPrefix: string }) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotation}) scale(${scale})`}>
      {/* Mini Wings - Animated Flapping */}
      <g className="worker-wings">
        <ellipse cx="-3" cy="-1" rx="2.5" ry="1.5" fill="#00D4B3" opacity="0.6" transform="rotate(-20 -3 -1)"/>
        <ellipse cx="3" cy="-1" rx="2.5" ry="1.5" fill="#00D4B3" opacity="0.6" transform="rotate(20 3 -1)"/>
      </g>
      
      {/* Mini Body */}
      <ellipse cx="0" cy="0" rx="2" ry="3" fill={`url(#${idPrefix}-body)`}/>
      
      {/* Mini Stripes */}
      <rect x="-1.5" y="-0.5" width="3" height="0.8" rx="0.3" fill="#1a1a1a"/>
      <rect x="-1.5" y="0.7" width="3" height="0.8" rx="0.3" fill="#1a1a1a"/>
      
      {/* Mini Head */}
      <circle cx="0" cy="-3" r="1.2" fill={`url(#${idPrefix}-body)`}/>
      
      {/* Mini Tech Glow */}
      <circle cx="0" cy="0" r="0.3" fill="#00D4B3" opacity="0.8"/>
    </g>
  );
}

// ============================================================================
// LEGACY EXPORTS - For backward compatibility (all use UniversalLogo)
// ============================================================================
export function SimplifiedMobileLogo({ className = "" }: { className?: string }) {
  return <UniversalLogo variant="full" size="md" className={className} />;
}

export function HexadLogo({ size = "default", className = "" }: { size?: "default" | "sm"; className?: string }) {
  return <UniversalLogo variant="full" size={size === "sm" ? "md" : "lg"} className={className} />;
}

export function HexadIcon({ size = 48, className = "" }: { size?: number; className?: string }) {
  const sizeVariant = size < 80 ? "sm" : size < 200 ? "md" : "lg";
  return <UniversalLogo variant="icon" size={sizeVariant} className={className} />;
}
