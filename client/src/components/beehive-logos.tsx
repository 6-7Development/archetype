// BeehiveAI Custom SVG Logos - Scalable & Editable

// BeehiveAI Icon Logo (detailed honeycomb with flying bees)
export function BeehiveIcon({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 120 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer glow effect */}
      <circle cx="60" cy="60" r="55" fill="url(#outerGlow)" opacity="0.3"/>
      
      {/* Main honeycomb structure - large hexagon */}
      <path 
        d="M60 10 L95 30 L95 70 L60 90 L25 70 L25 30 Z" 
        fill="url(#honeyGradient)"
        stroke="#F7B500"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      
      {/* Inner honeycomb cells - more detailed pattern */}
      <g opacity="0.8">
        {/* Center cell - highlighted */}
        <path d="M60 40 L70 46 L70 58 L60 64 L50 58 L50 46 Z" 
          fill="url(#cellGradient)" 
          stroke="#F7B500" 
          strokeWidth="2"/>
        
        {/* Top row cells */}
        <path d="M42 28 L52 34 L52 46 L42 52 L32 46 L32 34 Z" 
          fill="#FFD34D" stroke="#F7B500" strokeWidth="1.5" opacity="0.7"/>
        <path d="M60 22 L70 28 L70 40 L60 46 L50 40 L50 28 Z" 
          fill="#FFD34D" stroke="#F7B500" strokeWidth="1.5" opacity="0.7"/>
        <path d="M78 28 L88 34 L88 46 L78 52 L68 46 L68 34 Z" 
          fill="#FFD34D" stroke="#F7B500" strokeWidth="1.5" opacity="0.7"/>
        
        {/* Middle row cells */}
        <path d="M42 52 L52 58 L52 70 L42 76 L32 70 L32 58 Z" 
          fill="#FFD34D" stroke="#F7B500" strokeWidth="1.5" opacity="0.7"/>
        <path d="M78 52 L88 58 L88 70 L78 76 L68 70 L68 58 Z" 
          fill="#FFD34D" stroke="#F7B500" strokeWidth="1.5" opacity="0.7"/>
        
        {/* Bottom row cells */}
        <path d="M60 64 L70 70 L70 82 L60 88 L50 82 L50 70 Z" 
          fill="#FFD34D" stroke="#F7B500" strokeWidth="1.5" opacity="0.7"/>
      </g>
      
      {/* Honey drips and details */}
      <g opacity="0.9">
        <path d="M60 82 Q60 87, 60 90 Q60 93, 58 93 Q56 93, 56 90 Q56 87, 56 82" fill="#F7B500"/>
        <ellipse cx="58" cy="93" rx="2.5" ry="3" fill="#F7B500" opacity="0.8"/>
      </g>
      
      {/* Drone Bee #1 - Top Right */}
      <g transform="translate(85, 25)">
        {/* Body */}
        <ellipse cx="0" cy="0" rx="4" ry="6" fill="#FFD34D"/>
        <rect x="-3.5" y="-3" width="7" height="1.5" fill="#F7B500"/>
        <rect x="-3.5" y="0" width="7" height="1.5" fill="#F7B500"/>
        <rect x="-3.5" y="3" width="7" height="1.5" fill="#F7B500"/>
        {/* Head */}
        <circle cx="0" cy="-7" r="2.5" fill="#F7B500"/>
        {/* Wings - animated look */}
        <ellipse cx="-3" cy="-2" rx="4" ry="2" fill="white" opacity="0.7" transform="rotate(-15 -3 -2)"/>
        <ellipse cx="3" cy="-2" rx="4" ry="2" fill="white" opacity="0.7" transform="rotate(15 3 -2)"/>
        {/* Antennae */}
        <line x1="-1" y1="-8" x2="-2" y2="-11" stroke="#F7B500" strokeWidth="0.8"/>
        <line x1="1" y1="-8" x2="2" y2="-11" stroke="#F7B500" strokeWidth="0.8"/>
      </g>
      
      {/* Drone Bee #2 - Left Side */}
      <g transform="translate(18, 50) rotate(-20)">
        {/* Body */}
        <ellipse cx="0" cy="0" rx="3.5" ry="5.5" fill="#FFD34D"/>
        <rect x="-3" y="-2.5" width="6" height="1.2" fill="#F7B500"/>
        <rect x="-3" y="0" width="6" height="1.2" fill="#F7B500"/>
        <rect x="-3" y="2.5" width="6" height="1.2" fill="#F7B500"/>
        {/* Head */}
        <circle cx="0" cy="-6.5" r="2.2" fill="#F7B500"/>
        {/* Wings */}
        <ellipse cx="-2.5" cy="-1.5" rx="3.5" ry="1.8" fill="white" opacity="0.7" transform="rotate(-20 -2.5 -1.5)"/>
        <ellipse cx="2.5" cy="-1.5" rx="3.5" ry="1.8" fill="white" opacity="0.7" transform="rotate(20 2.5 -1.5)"/>
        {/* Antennae */}
        <line x1="-0.8" y1="-7.5" x2="-1.8" y2="-10" stroke="#F7B500" strokeWidth="0.7"/>
        <line x1="0.8" y1="-7.5" x2="1.8" y2="-10" stroke="#F7B500" strokeWidth="0.7"/>
      </g>
      
      {/* Drone Bee #3 - Bottom Right */}
      <g transform="translate(100, 75) rotate(30)">
        {/* Body */}
        <ellipse cx="0" cy="0" rx="3.5" ry="5.5" fill="#FFD34D"/>
        <rect x="-3" y="-2.5" width="6" height="1.2" fill="#F7B500"/>
        <rect x="-3" y="0" width="6" height="1.2" fill="#F7B500"/>
        <rect x="-3" y="2.5" width="6" height="1.2" fill="#F7B500"/>
        {/* Head */}
        <circle cx="0" cy="-6.5" r="2.2" fill="#F7B500"/>
        {/* Wings */}
        <ellipse cx="-2.5" cy="-1.5" rx="3.5" ry="1.8" fill="white" opacity="0.7" transform="rotate(-25 -2.5 -1.5)"/>
        <ellipse cx="2.5" cy="-1.5" rx="3.5" ry="1.8" fill="white" opacity="0.7" transform="rotate(25 2.5 -1.5)"/>
        {/* Antennae */}
        <line x1="-0.8" y1="-7.5" x2="-1.8" y2="-10" stroke="#F7B500" strokeWidth="0.7"/>
        <line x1="0.8" y1="-7.5" x2="1.8" y2="-10" stroke="#F7B500" strokeWidth="0.7"/>
      </g>
      
      {/* Motion trails for bees */}
      <g opacity="0.3" stroke="#FFD34D" strokeWidth="1" fill="none" strokeDasharray="2,2">
        <path d="M 75 20 Q 80 22, 85 25"/>
        <path d="M 12 45 Q 15 47, 18 50"/>
        <path d="M 95 70 Q 97 72, 100 75"/>
      </g>
      
      {/* Gradient definitions */}
      <defs>
        <linearGradient id="honeyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFD34D" stopOpacity="0.4"/>
          <stop offset="50%" stopColor="#F7B500" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#F7B500" stopOpacity="0.6"/>
        </linearGradient>
        
        <radialGradient id="cellGradient" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#FFD34D" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#F7B500" stopOpacity="0.7"/>
        </radialGradient>
        
        <radialGradient id="outerGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#F7B500" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#F7B500" stopOpacity="0"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

// BeehiveAI Word Logo with honey dripping effect
export function BeehiveWordLogo({ size = "default", className = "" }: { size?: "sm" | "default" | "lg"; className?: string }) {
  const sizeMap = {
    sm: { width: 180, height: 50 },
    default: { width: 240, height: 65 },
    lg: { width: 320, height: 85 }
  };
  
  const { width, height } = sizeMap[size];
  
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 240 65" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* BeehiveAI Text */}
      <text 
        x="5" 
        y="35" 
        fontFamily="Inter, system-ui, sans-serif" 
        fontSize="32" 
        fontWeight="700" 
        fill="url(#textGradient)"
        letterSpacing="-0.5"
      >
        BeehiveAI
      </text>
      
      {/* Honey drips from letters */}
      <g opacity="0.9">
        {/* Drip from 'B' */}
        <path d="M18 35 Q18 40, 18 42 Q18 45, 16 45 Q14 45, 14 42 Q14 40, 14 35" fill="#F7B500"/>
        
        {/* Drip from first 'e' */}
        <path d="M40 35 Q40 38, 40 40 Q40 42, 38 42 Q36 42, 36 40 Q36 38, 36 35" fill="#FFD34D"/>
        
        {/* Drip from 'h' */}
        <path d="M70 35 Q70 40, 70 43 Q70 46, 68 46 Q66 46, 66 43 Q66 40, 66 35" fill="#F7B500"/>
        
        {/* Drip from 'v' */}
        <path d="M105 35 Q105 37, 105 39 Q105 41, 103 41 Q101 41, 101 39 Q101 37, 101 35" fill="#FFD34D"/>
        
        {/* Drip from 'A' */}
        <path d="M150 35 Q150 41, 150 44 Q150 47, 148 47 Q146 47, 146 44 Q146 41, 146 35" fill="#F7B500"/>
        
        {/* Drip from 'I' */}
        <path d="M200 35 Q200 38, 200 40 Q200 43, 198 43 Q196 43, 196 40 Q196 38, 196 35" fill="#FFD34D"/>
      </g>
      
      {/* Subtle glow effect */}
      <rect x="0" y="0" width="240" height="65" fill="url(#glow)" opacity="0.1"/>
      
      {/* Gradient definitions */}
      <defs>
        <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F7B500"/>
          <stop offset="40%" stopColor="#FFD34D"/>
          <stop offset="70%" stopColor="#00D4B3"/>
          <stop offset="100%" stopColor="#FFD34D"/>
        </linearGradient>
        
        <radialGradient id="glow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#F7B500" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#F7B500" stopOpacity="0"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

// Combined logo (icon + text) - useful for some contexts
export function BeehiveLogo({ iconSize = 40, textSize = "default" }: { iconSize?: number; textSize?: "sm" | "default" | "lg" }) {
  return (
    <div className="flex items-center gap-3">
      <BeehiveIcon size={iconSize} />
      <BeehiveWordLogo size={textSize} />
    </div>
  );
}
