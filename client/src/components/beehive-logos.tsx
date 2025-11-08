// BeehiveAI Custom SVG Logos - Scalable & Editable

// BeehiveAI Icon Logo (realistic professional honeycomb)
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
      {/* Drop shadow for depth */}
      <ellipse cx="60" cy="92" rx="40" ry="8" fill="rgba(47,27,11,0.35)" filter="url(#dropShadow)"/>
      
      {/* Main honeycomb outer shell - realistic beeswax */}
      <path 
        d="M60 15 L90 32 L90 66 L60 83 L30 66 L30 32 Z" 
        fill="url(#waxGradient)"
        stroke="url(#waxStroke)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        filter="url(#bevelEffect)"
      />
      
      {/* Inner shadow along edges for depth */}
      <path 
        d="M60 15 L90 32 L90 66 L60 83 L30 66 L30 32 Z" 
        fill="none"
        stroke="url(#innerShadow)"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.6"
      />
      
      {/* Inner honeycomb cells - recessed depth with natural wax */}
      <g>
        {/* Center cell - deepest with radial shading */}
        <path d="M60 42 L68 47 L68 57 L60 62 L52 57 L52 47 Z" 
          fill="url(#recessedCell)" 
          stroke="url(#cellEdge)" 
          strokeWidth="1.8"
          filter="url(#cellDepth)"/>
        
        {/* Top row cells - angled lighting */}
        <path d="M44 32 L52 37 L52 47 L44 52 L36 47 L36 37 Z" 
          fill="url(#lightCell)" 
          stroke="url(#cellEdge)" 
          strokeWidth="1.5"
          filter="url(#cellDepth)"/>
          
        <path d="M60 26 L68 31 L68 41 L60 46 L52 41 L52 31 Z" 
          fill="url(#lightCell)" 
          stroke="url(#cellEdge)" 
          strokeWidth="1.5"
          filter="url(#cellDepth)"/>
          
        <path d="M76 32 L84 37 L84 47 L76 52 L68 47 L68 37 Z" 
          fill="url(#lightCell)" 
          stroke="url(#cellEdge)" 
          strokeWidth="1.5"
          filter="url(#cellDepth)"/>
        
        {/* Middle row cells */}
        <path d="M44 52 L52 57 L52 67 L44 72 L36 67 L36 57 Z" 
          fill="url(#lightCell)" 
          stroke="url(#cellEdge)" 
          strokeWidth="1.5"
          filter="url(#cellDepth)"/>
          
        <path d="M76 52 L84 57 L84 67 L76 72 L68 67 L68 57 Z" 
          fill="url(#lightCell)" 
          stroke="url(#cellEdge)" 
          strokeWidth="1.5"
          filter="url(#cellDepth)"/>
        
        {/* Bottom cell */}
        <path d="M60 62 L68 67 L68 77 L60 82 L52 77 L52 67 Z" 
          fill="url(#lightCell)" 
          stroke="url(#cellEdge)" 
          strokeWidth="1.5"
          filter="url(#cellDepth)"/>
      </g>
      
      {/* Realistic translucent honey drip - viscous flow */}
      <g className="honey-drip">
        {/* Pooling honey at hive edge - darker viscous base */}
        <ellipse cx="60" cy="80" rx="5" ry="2.5" fill="url(#honeyPool)" opacity="0.85"/>
        
        {/* Main drip stream - tapered bezier for viscosity */}
        <path d="M62 80 Q62 85, 61.5 90 Q61 95, 60.5 100 Q60.2 104, 60 106 Q59.8 104, 59.5 100 Q59 95, 58.5 90 Q58 85, 58 80" 
          fill="url(#honeyBase)" 
          opacity="0.85"
          filter="url(#honeyGlow)"/>
        
        {/* Inner translucent core - lighter */}
        <path d="M61 82 Q61 86, 60.7 91 Q60.4 96, 60.2 101 Q60.1 103, 60 104.5 Q59.9 103, 59.8 101 Q59.6 96, 59.3 91 Q59 86, 59 82" 
          fill="url(#honeyCore)" 
          opacity="0.55"/>
        
        {/* Refractive edge highlight */}
        <path d="M61.5 81 Q61.5 85, 61.2 90 Q61 95, 60.8 100" 
          stroke="url(#honeyRefract)" 
          strokeWidth="0.8"
          opacity="0.25"
          fill="none"/>
        
        {/* Glossy drop - multi-layer translucency */}
        <ellipse cx="60" cy="107" rx="5" ry="6" fill="url(#dropShadow)" filter="url(#honeyGlow)"/>
        <ellipse cx="60" cy="107" rx="4.5" ry="5.5" fill="url(#dropBase)" opacity="0.85"/>
        <ellipse cx="60" cy="107" rx="4" ry="5" fill="url(#dropCore)" opacity="0.55"/>
        
        {/* Specular highlights - light scattering */}
        <ellipse cx="58.5" cy="104" rx="1.8" ry="2.5" fill="url(#honeyShine)" opacity="0.7"/>
        <ellipse cx="61" cy="106.5" rx="1" ry="1.5" fill="url(#honeyShine)" opacity="0.4"/>
        
        {/* Underside shadow blur */}
        <ellipse cx="60" cy="112" rx="4" ry="2" fill="rgba(47,27,11,0.25)" filter="url(#dropShadow)"/>
      </g>
      
      
      {/* Professional gradients - natural beeswax and honey colors */}
      <defs>
        {/* SVG Filters for depth */}
        <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.4"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        <filter id="bevelEffect">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur"/>
          <feSpecularLighting in="blur" surfaceScale="3" specularConstant="0.5" specularExponent="20" lightingColor="white" result="specular">
            <fePointLight x="-5000" y="-10000" z="20000"/>
          </feSpecularLighting>
          <feComposite in="specular" in2="SourceAlpha" operator="in" result="specular"/>
          <feComposite in="SourceGraphic" in2="specular" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
        </filter>
        
        <filter id="cellDepth">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.5"/>
        </filter>
        
        <filter id="honeyGlow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
          <feColorMatrix in="blur" type="saturate" values="1.5" result="saturated"/>
          <feComponentTransfer in="saturated" result="glowEffect">
            <feFuncA type="discrete" tableValues="0 0.5 1"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="glowEffect"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        {/* Realistic beeswax gradients */}
        <linearGradient id="waxGradient" x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#FFE7B8"/>
          <stop offset="25%" stopColor="#F2B347"/>
          <stop offset="60%" stopColor="#D6A656"/>
          <stop offset="100%" stopColor="#9A6B2F"/>
        </linearGradient>
        
        <linearGradient id="waxStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9A6B2F"/>
          <stop offset="100%" stopColor="#5B3A1A"/>
        </linearGradient>
        
        <linearGradient id="innerShadow" x1="30%" y1="30%" x2="70%" y2="70%">
          <stop offset="0%" stopColor="#5B3A1A"/>
          <stop offset="100%" stopColor="transparent"/>
        </linearGradient>
        
        {/* Cell depth gradients */}
        <radialGradient id="recessedCell" cx="50%" cy="45%">
          <stop offset="0%" stopColor="#C9821F"/>
          <stop offset="50%" stopColor="#A36112"/>
          <stop offset="100%" stopColor="#5B3A1A"/>
        </radialGradient>
        
        <radialGradient id="lightCell" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#FFE7B8"/>
          <stop offset="40%" stopColor="#F2B347"/>
          <stop offset="100%" stopColor="#C9821F"/>
        </radialGradient>
        
        <linearGradient id="cellEdge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9A6B2F"/>
          <stop offset="100%" stopColor="#5B3A1A"/>
        </linearGradient>
        
        {/* Realistic translucent honey */}
        <linearGradient id="honeyPool" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#A36112"/>
          <stop offset="100%" stopColor="#C9821F"/>
        </linearGradient>
        
        <linearGradient id="honeyBase" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#A36112"/>
          <stop offset="30%" stopColor="#C9821F"/>
          <stop offset="70%" stopColor="#F2B347"/>
          <stop offset="100%" stopColor="#C9821F"/>
        </linearGradient>
        
        <linearGradient id="honeyCore" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F2B347"/>
          <stop offset="50%" stopColor="#FFE7B8"/>
          <stop offset="100%" stopColor="#F2B347"/>
        </linearGradient>
        
        <linearGradient id="honeyRefract" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFE7B8"/>
          <stop offset="100%" stopColor="transparent"/>
        </linearGradient>
        
        {/* Drop gradients */}
        <radialGradient id="dropShadow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(91,58,26,0.5)"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        
        <radialGradient id="dropBase" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#F2B347"/>
          <stop offset="50%" stopColor="#C9821F"/>
          <stop offset="100%" stopColor="#A36112"/>
        </radialGradient>
        
        <radialGradient id="dropCore" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#FFE7B8"/>
          <stop offset="60%" stopColor="#F2B347"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        
        <radialGradient id="honeyShine" cx="50%" cy="50%">
          <stop offset="0%" stopColor="white"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        
      </defs>
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
      {/* Beehive Text - Natural amber/wax tones */}
      <text 
        x="10" 
        y="55" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="48" 
        fontWeight="800" 
        fill="url(#textGradient)"
        letterSpacing="-1"
      >
        Beehive
      </text>
      
      {/* AI Text - Mint Accent */}
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
      
      {/* Professional honey drip - subtle accent */}
      <g opacity="0.85">
        <path d="M155 55 Q155 60, 155 64 Q155 68, 153.5 69 Q152 68, 152 64 Q152 60, 152 55" 
          fill="url(#textHoneyFlow)" 
          stroke="#9A6B2F" 
          strokeWidth="0.5"/>
        <ellipse cx="153.5" cy="69" rx="2.5" ry="3.5" fill="url(#textHoneyDrop)"/>
        <ellipse cx="152.8" cy="67.5" rx="1" ry="1.3" fill="white" opacity="0.5"/>
      </g>
      
      {/* Text gradients */}
      <defs>
        <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D6A656"/>
          <stop offset="50%" stopColor="#F2B347"/>
          <stop offset="100%" stopColor="#C9821F"/>
        </linearGradient>
        
        <linearGradient id="textHoneyFlow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#A36112"/>
          <stop offset="100%" stopColor="#C9821F"/>
        </linearGradient>
        
        <radialGradient id="textHoneyDrop" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#F2B347"/>
          <stop offset="100%" stopColor="#A36112"/>
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
