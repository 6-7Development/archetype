// BeehiveAI Custom SVG Logos - Circuit Board Tech Design

// BeehiveIcon - Tech/Circuit Board Style (matches reference)
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
      {/* Main hive body - layered orange/golden gradient */}
      <g>
        {/* Bottom layer */}
        <path 
          d="M60 85 L85 72 L85 52 L60 39 L35 52 L35 72 Z" 
          fill="#E5943C"
          stroke="#1A2332"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        
        {/* Middle-bottom layer */}
        <path 
          d="M60 75 L82 64 L82 48 L60 37 L38 48 L38 64 Z" 
          fill="#F5A847"
          stroke="#1A2332"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        
        {/* Middle-top layer */}
        <path 
          d="M60 65 L79 56 L79 44 L60 35 L41 44 L41 56 Z" 
          fill="#FDB853"
          stroke="#1A2332"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        
        {/* Top layer */}
        <ellipse 
          cx="60" 
          cy="38" 
          rx="18" 
          ry="12" 
          fill="#FFC864"
          stroke="#1A2332"
          strokeWidth="4"
        />
        
        {/* Entrance dark opening */}
        <ellipse 
          cx="60" 
          cy="58" 
          rx="10" 
          ry="14" 
          fill="#1A2332"
        />
      </g>
      
      {/* Circuit board connections - extending from hive */}
      <g stroke="#1A2332" strokeWidth="3" fill="none" strokeLinecap="round">
        {/* Left connections */}
        <path d="M35 52 L20 45" />
        <path d="M35 62 L18 62" />
        <path d="M38 70 L22 78" />
        
        {/* Right connections */}
        <path d="M85 52 L100 45" />
        <path d="M85 62 L102 62" />
        <path d="M82 70 L98 78" />
      </g>
      
      {/* Circuit nodes (circles at connection endpoints) */}
      <g fill="#F5A847" stroke="#1A2332" strokeWidth="2.5">
        <circle cx="20" cy="45" r="4" />
        <circle cx="18" cy="62" r="4" />
        <circle cx="22" cy="78" r="4" />
        <circle cx="100" cy="45" r="4" />
        <circle cx="102" cy="62" r="4" />
        <circle cx="98" cy="78" r="4" />
      </g>
      
      {/* Simple flying bees - clean design */}
      <g>
        {/* Bee 1 - top left */}
        <ellipse cx="25" cy="20" rx="5" ry="7" fill="#1A2332"/>
        <ellipse cx="25" cy="17" rx="3.5" ry="4" fill="#F5A847"/>
        <path d="M20 18 L18 15 M20 21 L18 24" stroke="#1A2332" strokeWidth="2" fill="none"/>
        <path d="M30 18 L32 15 M30 21 L32 24" stroke="#1A2332" strokeWidth="2" fill="none"/>
        
        {/* Bee 2 - top right */}
        <ellipse cx="95" cy="18" rx="5" ry="7" fill="#1A2332"/>
        <ellipse cx="95" cy="15" rx="3.5" ry="4" fill="#F5A847"/>
        <path d="M90 16 L88 13 M90 19 L88 22" stroke="#1A2332" strokeWidth="2" fill="none"/>
        <path d="M100 16 L102 13 M100 19 L102 22" stroke="#1A2332" strokeWidth="2" fill="none"/>
        
        {/* Bee 3 - right side */}
        <ellipse cx="108" cy="35" rx="5" ry="7" fill="#1A2332"/>
        <ellipse cx="108" cy="32" rx="3.5" ry="4" fill="#F5A847"/>
        <path d="M103 33 L101 30 M103 36 L101 39" stroke="#1A2332" strokeWidth="2" fill="none"/>
        <path d="M113 33 L115 30 M113 36 L115 39" stroke="#1A2332" strokeWidth="2" fill="none"/>
      </g>
    </svg>
  );
}

// BeehiveLogo - Full horizontal logo with text
export function BeehiveLogo({ className = "" }: { className?: string }) {
  return (
    <svg 
      width="320" 
      height="80" 
      viewBox="0 0 320 80" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Icon */}
      <g transform="translate(10, 10)">
        {/* Main hive body - compact version */}
        <path 
          d="M30 42 L42 36 L42 26 L30 20 L18 26 L18 36 Z" 
          fill="#E5943C"
          stroke="#1A2332"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path 
          d="M30 38 L40 33 L40 24 L30 19 L20 24 L20 33 Z" 
          fill="#F5A847"
          stroke="#1A2332"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path 
          d="M30 34 L38 30 L38 22 L30 18 L22 22 L22 30 Z" 
          fill="#FDB853"
          stroke="#1A2332"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <ellipse 
          cx="30" 
          cy="20" 
          rx="9" 
          ry="6" 
          fill="#FFC864"
          stroke="#1A2332"
          strokeWidth="2.5"
        />
        <ellipse 
          cx="30" 
          cy="29" 
          rx="5" 
          ry="7" 
          fill="#1A2332"
        />
        
        {/* Circuit connections */}
        <g stroke="#1A2332" strokeWidth="2" fill="none">
          <path d="M18 26 L10 23" />
          <path d="M18 31 L9 31" />
          <path d="M42 26 L50 23" />
          <path d="M42 31 L51 31" />
        </g>
        
        {/* Nodes */}
        <g fill="#F5A847" stroke="#1A2332" strokeWidth="1.5">
          <circle cx="10" cy="23" r="2" />
          <circle cx="9" cy="31" r="2" />
          <circle cx="50" cy="23" r="2" />
          <circle cx="51" cy="31" r="2" />
        </g>
      </g>
      
      {/* Text - Natural amber/golden gradient */}
      <text 
        x="75" 
        y="50" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="36" 
        fontWeight="800" 
        fill="url(#textGradient)"
        letterSpacing="-1"
      >
        Beehive
      </text>
      
      <text 
        x="220" 
        y="50" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="36" 
        fontWeight="800" 
        fill="#00D4B3"
        letterSpacing="-1"
      >
        AI
      </text>
      
      {/* Text gradient */}
      <defs>
        <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E5943C"/>
          <stop offset="50%" stopColor="#F5A847"/>
          <stop offset="100%" stopColor="#FDB853"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Mobile Logo - Compact version
export function BeehiveLogoMobile({ className = "" }: { className?: string }) {
  return (
    <svg 
      width="180" 
      height="50" 
      viewBox="0 0 180 50" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Icon - small version */}
      <g transform="translate(5, 5)">
        <path 
          d="M20 28 L28 24 L28 17 L20 13 L12 17 L12 24 Z" 
          fill="#E5943C"
          stroke="#1A2332"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path 
          d="M20 25 L26 22 L26 16 L20 13 L14 16 L14 22 Z" 
          fill="#F5A847"
          stroke="#1A2332"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <ellipse 
          cx="20" 
          cy="14" 
          rx="6" 
          ry="4" 
          fill="#FFC864"
          stroke="#1A2332"
          strokeWidth="1.8"
        />
        <ellipse 
          cx="20" 
          cy="19" 
          rx="3.5" 
          ry="5" 
          fill="#1A2332"
        />
      </g>
      
      {/* Text - compact */}
      <text 
        x="50" 
        y="32" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="24" 
        fontWeight="800" 
        fill="url(#textGradientMobile)"
        letterSpacing="-0.5"
      >
        Beehive
      </text>
      
      <text 
        x="140" 
        y="32" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="24" 
        fontWeight="800" 
        fill="#00D4B3"
        letterSpacing="-0.5"
      >
        AI
      </text>
      
      <defs>
        <linearGradient id="textGradientMobile" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E5943C"/>
          <stop offset="50%" stopColor="#F5A847"/>
          <stop offset="100%" stopColor="#FDB853"/>
        </linearGradient>
      </defs>
    </svg>
  );
}
