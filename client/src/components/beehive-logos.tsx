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

// Clean Professional Combined Logo (Icon + Text)
export function BeehiveWordLogo({ size = "default", className = "" }: { size?: "sm" | "default" | "lg"; className?: string }) {
  const sizeMap = {
    sm: { width: 200, height: 60 },
    default: { width: 280, height: 80 },
    lg: { width: 360, height: 100 }
  };
  
  const { width, height } = sizeMap[size];
  const scale = size === "sm" ? 0.75 : size === "lg" ? 1.25 : 1;
  
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 400 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Beehive Text - Clean and Bold */}
      <text 
        x="10" 
        y="55" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="48" 
        fontWeight="800" 
        fill="#F7B500"
        letterSpacing="-1"
      >
        Beehive
      </text>
      
      {/* AI Text - Accent Color */}
      <text 
        x="230" 
        y="55" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="48" 
        fontWeight="800" 
        fill="#00D4B3"
        letterSpacing="-1"
      >
        AI
      </text>
      
      {/* Subtle single honey drip accent - clean and minimal */}
      <g opacity="0.8">
        <path d="M155 55 Q155 62, 155 66 Q155 70, 153 70 Q151 70, 151 66 Q151 62, 151 55" 
          fill="url(#cleanHoneyGradient)" 
          stroke="#D4940F" 
          strokeWidth="0.5"/>
        <ellipse cx="153" cy="70" rx="3" ry="4" fill="url(#cleanDropGradient)"/>
        <ellipse cx="152" cy="68" rx="1.2" ry="1.5" fill="white" opacity="0.5"/>
      </g>
      
      {/* Gradients */}
      <defs>
        <linearGradient id="cleanHoneyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F7B500"/>
          <stop offset="100%" stopColor="#D4940F"/>
        </linearGradient>
        
        <radialGradient id="cleanDropGradient" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#FFD34D"/>
          <stop offset="100%" stopColor="#D4940F"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

// Combined logo with integrated design
export function BeehiveLogo({ size = "default" }: { size?: "sm" | "default" | "lg" }) {
  const sizeMap = {
    sm: { iconSize: 60, textSize: "sm" as const, gap: 3 },
    default: { iconSize: 80, textSize: "default" as const, gap: 4 },
    lg: { iconSize: 100, textSize: "lg" as const, gap: 5 }
  };
  
  const config = sizeMap[size];
  
  return (
    <div className={`flex items-center gap-${config.gap}`}>
      <BeehiveIcon size={config.iconSize} />
      <BeehiveWordLogo size={config.textSize} />
    </div>
  );
}
