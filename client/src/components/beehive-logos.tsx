// BeehiveAI Custom SVG Logos - Scalable & Editable

// BeehiveAI Icon Logo (honeycomb hexagon with bee accent)
export function BeehiveIcon({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer honeycomb hexagon */}
      <path 
        d="M50 5 L85 27.5 L85 72.5 L50 95 L15 72.5 L15 27.5 Z" 
        fill="url(#honeyGradient)"
        stroke="#F7B500"
        strokeWidth="2"
      />
      
      {/* Inner honeycomb cells */}
      <g opacity="0.6">
        <path d="M50 35 L60 41 L60 53 L50 59 L40 53 L40 41 Z" fill="#FFD34D" stroke="#F7B500" strokeWidth="1.5"/>
        <path d="M35 23 L45 29 L45 41 L35 47 L25 41 L25 29 Z" fill="#FFD34D" stroke="#F7B500" strokeWidth="1"/>
        <path d="M65 23 L75 29 L75 41 L65 47 L55 41 L55 29 Z" fill="#FFD34D" stroke="#F7B500" strokeWidth="1"/>
        <path d="M35 53 L45 59 L45 71 L35 77 L25 71 L25 59 Z" fill="#FFD34D" stroke="#F7B500" strokeWidth="1"/>
        <path d="M65 53 L75 59 L75 71 L65 77 L55 71 L55 59 Z" fill="#FFD34D" stroke="#F7B500" strokeWidth="1"/>
      </g>
      
      {/* Honey drop accent */}
      <ellipse cx="50" cy="75" rx="4" ry="6" fill="#F7B500" opacity="0.8"/>
      
      {/* Bee body (simple) */}
      <g transform="translate(62, 30)">
        <ellipse cx="0" cy="0" rx="3.5" ry="5" fill="#FFD34D"/>
        <rect x="-3" y="-2" width="6" height="1" fill="#F7B500"/>
        <rect x="-3" y="1" width="6" height="1" fill="#F7B500"/>
        {/* Wings */}
        <ellipse cx="-2" cy="-1" rx="2.5" ry="1.5" fill="white" opacity="0.6"/>
        <ellipse cx="2" cy="-1" rx="2.5" ry="1.5" fill="white" opacity="0.6"/>
      </g>
      
      {/* Gradient definition */}
      <defs>
        <linearGradient id="honeyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFD34D" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#F7B500" stopOpacity="0.3"/>
        </linearGradient>
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
