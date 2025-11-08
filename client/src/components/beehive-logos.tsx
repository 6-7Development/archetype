// BeehiveAI Custom SVG Logos - Clean Circuit Board Tech Design

// BeehiveIcon - Pure Tech/Circuit Board Style
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
      {/* Main hexagon hive - clean geometric */}
      <path 
        d="M60 20 L85 35 L85 65 L60 80 L35 65 L35 35 Z" 
        fill="#F5A847"
        stroke="#1A2332"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      
      {/* Inner hexagon for depth */}
      <path 
        d="M60 30 L78 42 L78 58 L60 70 L42 58 L42 42 Z" 
        fill="#FDB853"
        stroke="#1A2332"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      
      {/* Center opening/core */}
      <circle 
        cx="60" 
        cy="50" 
        r="8" 
        fill="#1A2332"
      />
      
      {/* Circuit board traces radiating outward */}
      <g stroke="#1A2332" strokeWidth="3" fill="none" strokeLinecap="round">
        {/* Top traces */}
        <path d="M60 20 L60 8" />
        
        {/* Top-right traces */}
        <path d="M85 35 L95 28" />
        <path d="M85 50 L100 50" />
        
        {/* Bottom-right traces */}
        <path d="M85 65 L95 72" />
        <path d="M70 80 L75 92" />
        
        {/* Bottom traces */}
        <path d="M60 80 L60 92" />
        
        {/* Bottom-left traces */}
        <path d="M35 65 L25 72" />
        <path d="M45 80 L40 92" />
        
        {/* Top-left traces */}
        <path d="M35 35 L25 28" />
        <path d="M35 50 L20 50" />
      </g>
      
      {/* Circuit nodes (connection points) */}
      <g fill="#F5A847" stroke="#1A2332" strokeWidth="2">
        <circle cx="60" cy="8" r="3.5" />
        <circle cx="95" cy="28" r="3.5" />
        <circle cx="100" cy="50" r="3.5" />
        <circle cx="95" cy="72" r="3.5" />
        <circle cx="75" cy="92" r="3.5" />
        <circle cx="60" cy="92" r="3.5" />
        <circle cx="40" cy="92" r="3.5" />
        <circle cx="25" cy="72" r="3.5" />
        <circle cx="20" cy="50" r="3.5" />
        <circle cx="25" cy="28" r="3.5" />
      </g>
      
      {/* Minimal signal indicators (replacing bees with tech elements) */}
      <g fill="#00D4B3">
        {/* Top signal */}
        <circle cx="60" cy="12" r="2" opacity="0.8">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
        
        {/* Right signal */}
        <circle cx="98" cy="50" r="2" opacity="0.8">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2.5s" repeatCount="indefinite" />
        </circle>
        
        {/* Bottom-left signal */}
        <circle cx="42" cy="90" r="2" opacity="0.8">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" />
        </circle>
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
      {/* Icon - compact version */}
      <g transform="translate(10, 10)">
        {/* Main hexagon */}
        <path 
          d="M30 10 L45 18 L45 38 L30 46 L15 38 L15 18 Z" 
          fill="#F5A847"
          stroke="#1A2332"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        
        {/* Inner hexagon */}
        <path 
          d="M30 16 L40 22 L40 34 L30 40 L20 34 L20 22 Z" 
          fill="#FDB853"
          stroke="#1A2332"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        
        {/* Center core */}
        <circle cx="30" cy="28" r="5" fill="#1A2332" />
        
        {/* Circuit traces */}
        <g stroke="#1A2332" strokeWidth="2" fill="none">
          <path d="M30 10 L30 2" />
          <path d="M45 18 L52 14" />
          <path d="M45 38 L52 42" />
          <path d="M30 46 L30 54" />
          <path d="M15 38 L8 42" />
          <path d="M15 18 L8 14" />
        </g>
        
        {/* Circuit nodes */}
        <g fill="#F5A847" stroke="#1A2332" strokeWidth="1.5">
          <circle cx="30" cy="2" r="2.5" />
          <circle cx="52" cy="14" r="2.5" />
          <circle cx="52" cy="42" r="2.5" />
          <circle cx="30" cy="54" r="2.5" />
          <circle cx="8" cy="42" r="2.5" />
          <circle cx="8" cy="14" r="2.5" />
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
          d="M20 8 L30 14 L30 26 L20 32 L10 26 L10 14 Z" 
          fill="#F5A847"
          stroke="#1A2332"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path 
          d="M20 12 L26 16 L26 24 L20 28 L14 24 L14 16 Z" 
          fill="#FDB853"
          stroke="#1A2332"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="20" r="3.5" fill="#1A2332" />
        
        {/* Minimal circuit traces */}
        <g stroke="#1A2332" strokeWidth="1.5" fill="none">
          <path d="M20 8 L20 2" />
          <path d="M30 14 L36 10" />
          <path d="M20 32 L20 38" />
          <path d="M10 14 L4 10" />
        </g>
        
        {/* Nodes */}
        <g fill="#F5A847" stroke="#1A2332" strokeWidth="1">
          <circle cx="20" cy="2" r="1.5" />
          <circle cx="36" cy="10" r="1.5" />
          <circle cx="20" cy="38" r="1.5" />
          <circle cx="4" cy="10" r="1.5" />
        </g>
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
