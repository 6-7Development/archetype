// BeehiveAI Custom SVG Logos - Scalable & Editable

// BeehiveAI Icon Logo (detailed honeycomb with animated flying bees)
export function BeehiveIcon({ size = 80, className = "" }: { size?: number; className?: string }) {
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
      
      {/* Realistic honey drips with glossy effect */}
      <g className="honey-drips">
        {/* Main honey drip */}
        <path d="M60 82 Q60 86, 60 90 Q60 94, 58 95 Q56 94, 56 90 Q56 86, 56 82" 
          fill="url(#honeyDripGradient)" 
          stroke="#D4940F" 
          strokeWidth="0.5"/>
        {/* Glossy drop at bottom */}
        <ellipse cx="58" cy="95" rx="3.5" ry="4.5" fill="url(#dropGradient)"/>
        {/* Shine highlight */}
        <ellipse cx="57" cy="93" rx="1.2" ry="1.8" fill="white" opacity="0.6"/>
      </g>
      
      {/* Animated Robotic AI Drone Bee #1 */}
      <g className="drone-bee-1" style={{ transformOrigin: '60px 60px' }}>
        <g transform="translate(85, 25)">
          {/* Metallic body with gradient */}
          <ellipse cx="0" cy="0" rx="4" ry="6" fill="url(#metallicBody)"/>
          <rect x="-3.5" y="-3" width="7" height="1.5" fill="#F7B500"/>
          <rect x="-3.5" y="0" width="7" height="1.5" fill="#F7B500"/>
          <rect x="-3.5" y="3" width="7" height="1.5" fill="#F7B500"/>
          {/* Robotic head with shine */}
          <circle cx="0" cy="-7" r="2.5" fill="url(#roboticHead)"/>
          <circle cx="-0.5" cy="-7.5" r="0.8" fill="white" opacity="0.8"/>
          {/* Robotic wings with motion blur */}
          <ellipse cx="-3" cy="-2" rx="4" ry="2" fill="url(#wingGradient)" opacity="0.8" className="wing-left"/>
          <ellipse cx="3" cy="-2" rx="4" ry="2" fill="url(#wingGradient)" opacity="0.8" className="wing-right"/>
          {/* Digital antennae */}
          <line x1="-1" y1="-8" x2="-2" y2="-11" stroke="#00D4B3" strokeWidth="1.2" opacity="0.8"/>
          <line x1="1" y1="-8" x2="2" y2="-11" stroke="#00D4B3" strokeWidth="1.2" opacity="0.8"/>
          <circle cx="-2" cy="-11" r="0.8" fill="#00D4B3" opacity="0.9"/>
          <circle cx="2" cy="-11" r="0.8" fill="#00D4B3" opacity="0.9"/>
        </g>
      </g>
      
      {/* Animated Robotic AI Drone Bee #2 */}
      <g className="drone-bee-2" style={{ transformOrigin: '60px 60px' }}>
        <g transform="translate(18, 50) rotate(-20)">
          {/* Metallic body */}
          <ellipse cx="0" cy="0" rx="3.5" ry="5.5" fill="url(#metallicBody)"/>
          <rect x="-3" y="-2.5" width="6" height="1.2" fill="#F7B500"/>
          <rect x="-3" y="0" width="6" height="1.2" fill="#F7B500"/>
          <rect x="-3" y="2.5" width="6" height="1.2" fill="#F7B500"/>
          {/* Robotic head */}
          <circle cx="0" cy="-6.5" r="2.2" fill="url(#roboticHead)"/>
          <circle cx="-0.4" cy="-7" r="0.6" fill="white" opacity="0.8"/>
          {/* Wings */}
          <ellipse cx="-2.5" cy="-1.5" rx="3.5" ry="1.8" fill="url(#wingGradient)" opacity="0.8"/>
          <ellipse cx="2.5" cy="-1.5" rx="3.5" ry="1.8" fill="url(#wingGradient)" opacity="0.8"/>
          {/* Digital antennae */}
          <line x1="-0.8" y1="-7.5" x2="-1.8" y2="-10" stroke="#00D4B3" strokeWidth="1" opacity="0.8"/>
          <line x1="0.8" y1="-7.5" x2="1.8" y2="-10" stroke="#00D4B3" strokeWidth="1" opacity="0.8"/>
          <circle cx="-1.8" cy="-10" r="0.7" fill="#00D4B3" opacity="0.9"/>
          <circle cx="1.8" cy="-10" r="0.7" fill="#00D4B3" opacity="0.9"/>
        </g>
      </g>
      
      {/* Animated Robotic AI Drone Bee #3 */}
      <g className="drone-bee-3" style={{ transformOrigin: '60px 60px' }}>
        <g transform="translate(100, 75) rotate(30)">
          {/* Metallic body */}
          <ellipse cx="0" cy="0" rx="3.5" ry="5.5" fill="url(#metallicBody)"/>
          <rect x="-3" y="-2.5" width="6" height="1.2" fill="#F7B500"/>
          <rect x="-3" y="0" width="6" height="1.2" fill="#F7B500"/>
          <rect x="-3" y="2.5" width="6" height="1.2" fill="#F7B500"/>
          {/* Robotic head */}
          <circle cx="0" cy="-6.5" r="2.2" fill="url(#roboticHead)"/>
          <circle cx="-0.4" cy="-7" r="0.6" fill="white" opacity="0.8"/>
          {/* Wings */}
          <ellipse cx="-2.5" cy="-1.5" rx="3.5" ry="1.8" fill="url(#wingGradient)" opacity="0.8"/>
          <ellipse cx="2.5" cy="-1.5" rx="3.5" ry="1.8" fill="url(#wingGradient)" opacity="0.8"/>
          {/* Digital antennae */}
          <line x1="-0.8" y1="-7.5" x2="-1.8" y2="-10" stroke="#00D4B3" strokeWidth="1" opacity="0.8"/>
          <line x1="0.8" y1="-7.5" x2="1.8" y2="-10" stroke="#00D4B3" strokeWidth="1" opacity="0.8"/>
          <circle cx="-1.8" cy="-10" r="0.7" fill="#00D4B3" opacity="0.9"/>
          <circle cx="1.8" cy="-10" r="0.7" fill="#00D4B3" opacity="0.9"/>
        </g>
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
        
        {/* Glossy honey drip gradient */}
        <linearGradient id="honeyDripGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D4940F"/>
          <stop offset="50%" stopColor="#F7B500"/>
          <stop offset="100%" stopColor="#FFD34D"/>
        </linearGradient>
        
        {/* Glossy drop gradient */}
        <radialGradient id="dropGradient" cx="30%" cy="30%">
          <stop offset="0%" stopColor="#FFD34D"/>
          <stop offset="50%" stopColor="#F7B500"/>
          <stop offset="100%" stopColor="#D4940F"/>
        </radialGradient>
        
        {/* Metallic body gradient for robotic bees */}
        <linearGradient id="metallicBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD34D"/>
          <stop offset="50%" stopColor="#F7B500"/>
          <stop offset="100%" stopColor="#E6A615"/>
        </linearGradient>
        
        {/* Robotic head gradient */}
        <radialGradient id="roboticHead" cx="40%" cy="40%">
          <stop offset="0%" stopColor="#FFD34D"/>
          <stop offset="100%" stopColor="#F7B500"/>
        </radialGradient>
        
        {/* Wing gradient with cyan tint for robotic look */}
        <linearGradient id="wingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="white" stopOpacity="0.9"/>
          <stop offset="50%" stopColor="#E0FFFF" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="white" stopOpacity="0.9"/>
        </linearGradient>
      </defs>
      
      {/* CSS Animation styles */}
      <style>{`
        @keyframes orbit1 {
          0% { transform: rotate(0deg) translateX(35px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(35px) rotate(-360deg); }
        }
        @keyframes orbit2 {
          0% { transform: rotate(120deg) translateX(40px) rotate(-120deg); }
          100% { transform: rotate(480deg) translateX(40px) rotate(-480deg); }
        }
        @keyframes orbit3 {
          0% { transform: rotate(240deg) translateX(38px) rotate(-240deg); }
          100% { transform: rotate(600deg) translateX(38px) rotate(-600deg); }
        }
        @keyframes wingFlap {
          0%, 100% { transform: scaleX(1); }
          50% { transform: scaleX(1.3); }
        }
        .drone-bee-1 { animation: orbit1 8s linear infinite; }
        .drone-bee-2 { animation: orbit2 10s linear infinite; }
        .drone-bee-3 { animation: orbit3 9s linear infinite; }
        .wing-left, .wing-right { animation: wingFlap 0.2s ease-in-out infinite; }
      `}</style>
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
      
      {/* Realistic glossy honey drips from letters */}
      <g>
        {/* Drip from 'B' - glossy */}
        <g>
          <path d="M18 35 Q18 39, 18 41 Q18 43, 16.5 43 Q15 43, 15 41 Q15 39, 15 35" 
            fill="url(#honeyDripGradient)" stroke="#D4940F" strokeWidth="0.3"/>
          <ellipse cx="16.5" cy="43" rx="2" ry="2.5" fill="url(#dropGradient)"/>
          <ellipse cx="16" cy="42" rx="0.8" ry="1" fill="white" opacity="0.7"/>
        </g>
        
        {/* Drip from first 'e' */}
        <g>
          <path d="M40 35 Q40 37, 40 39 Q40 40, 38.5 40 Q37 40, 37 39 Q37 37, 37 35" 
            fill="url(#honeyDripGradient)" stroke="#D4940F" strokeWidth="0.3"/>
          <ellipse cx="38.5" cy="40" rx="1.8" ry="2.2" fill="url(#dropGradient)"/>
          <ellipse cx="38" cy="39" rx="0.7" ry="0.9" fill="white" opacity="0.7"/>
        </g>
        
        {/* Drip from 'h' */}
        <g>
          <path d="M70 35 Q70 39, 70 42 Q70 44, 68.5 44 Q67 44, 67 42 Q67 39, 67 35" 
            fill="url(#honeyDripGradient)" stroke="#D4940F" strokeWidth="0.3"/>
          <ellipse cx="68.5" cy="44" rx="2" ry="2.5" fill="url(#dropGradient)"/>
          <ellipse cx="68" cy="43" rx="0.8" ry="1" fill="white" opacity="0.7"/>
        </g>
        
        {/* Drip from 'v' */}
        <g>
          <path d="M105 35 Q105 36, 105 37.5 Q105 39, 103.5 39 Q102 39, 102 37.5 Q102 36, 102 35" 
            fill="url(#honeyDripGradient)" stroke="#D4940F" strokeWidth="0.3"/>
          <ellipse cx="103.5" cy="39" rx="1.7" ry="2" fill="url(#dropGradient)"/>
          <ellipse cx="103" cy="38" rx="0.6" ry="0.8" fill="white" opacity="0.7"/>
        </g>
        
        {/* Drip from 'A' */}
        <g>
          <path d="M150 35 Q150 40, 150 42 Q150 45, 148.5 45 Q147 45, 147 42 Q147 40, 147 35" 
            fill="url(#honeyDripGradient)" stroke="#D4940F" strokeWidth="0.3"/>
          <ellipse cx="148.5" cy="45" rx="2" ry="2.8" fill="url(#dropGradient)"/>
          <ellipse cx="148" cy="43.5" rx="0.8" ry="1.1" fill="white" opacity="0.7"/>
        </g>
        
        {/* Drip from 'I' */}
        <g>
          <path d="M200 35 Q200 37, 200 39 Q200 41, 198.5 41 Q197 41, 197 39 Q197 37, 197 35" 
            fill="url(#honeyDripGradient)" stroke="#D4940F" strokeWidth="0.3"/>
          <ellipse cx="198.5" cy="41" rx="1.8" ry="2.3" fill="url(#dropGradient)"/>
          <ellipse cx="198" cy="40" rx="0.7" ry="0.9" fill="white" opacity="0.7"/>
        </g>
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
