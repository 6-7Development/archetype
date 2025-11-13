// BeehiveAI Unified Logo System - Single source of truth for all brand assets

// ============================================================================
// CORE PRIMITIVE: Bee Glyph (Reusable Icon with Optional Tech Accents)
// ============================================================================
interface BeeGlyphProps {
  x?: number;
  y?: number;
  scale?: number;
  idPrefix?: string;
  showTechDetails?: boolean; // Enable tech accents for large logos
}

function BeeGlyph({ x = 0, y = 0, scale = 1, idPrefix = "bee", showTechDetails = false }: BeeGlyphProps) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      {/* Wings - Layered for depth with tech circuit traces */}
      <g opacity="0.9">
        {/* Left wing */}
        <ellipse cx="-6" cy="-2" rx="4.5" ry="3" fill={`url(#${idPrefix}WingGradient)`} transform="rotate(-15 -6 -2)"/>
        <ellipse cx="-5.5" cy="-1.5" rx="3.5" ry="2.2" fill="#00D4B3" opacity="0.4" transform="rotate(-15 -5.5 -1.5)"/>
        <path d="M-8 -3 Q-6 -1 -4 -2" stroke="#00B89E" strokeWidth="0.4" fill="none" opacity="0.6"/>
        
        {/* Tech details: Circuit traces on left wing */}
        {showTechDetails && (
          <g transform="rotate(-15 -6 -2)" stroke="#FFD34D" strokeWidth="0.25" opacity="0.5" fill="none">
            <path d="M-7.5 -2.5 L-6.5 -2.5 L-6 -2" />
            <path d="M-7 -1.5 L-6 -1.5" />
            <circle cx="-6.5" cy="-2.5" r="0.2" fill="#FFD34D" />
            <circle cx="-6" cy="-1.5" r="0.2" fill="#FFD34D" />
          </g>
        )}
        
        {/* Right wing */}
        <ellipse cx="6" cy="-2" rx="4.5" ry="3" fill={`url(#${idPrefix}WingGradient)`} transform="rotate(15 6 -2)"/>
        <ellipse cx="5.5" cy="-1.5" rx="3.5" ry="2.2" fill="#00D4B3" opacity="0.4" transform="rotate(15 5.5 -1.5)"/>
        <path d="M8 -3 Q6 -1 4 -2" stroke="#00B89E" strokeWidth="0.4" fill="none" opacity="0.6"/>
        
        {/* Tech details: Circuit traces on right wing */}
        {showTechDetails && (
          <g transform="rotate(15 6 -2)" stroke="#FFD34D" strokeWidth="0.25" opacity="0.5" fill="none">
            <path d="M7.5 -2.5 L6.5 -2.5 L6 -2" />
            <path d="M7 -1.5 L6 -1.5" />
            <circle cx="6.5" cy="-2.5" r="0.2" fill="#FFD34D" />
            <circle cx="6" cy="-1.5" r="0.2" fill="#FFD34D" />
          </g>
        )}
      </g>
      
      {/* Body - Gradient with depth */}
      <ellipse cx="0" cy="1" rx="4.5" ry="6" fill="#1a1a1a"/>
      <ellipse cx="0" cy="1" rx="4" ry="5.5" fill={`url(#${idPrefix}BodyGradient)`}/>
      
      {/* Body highlight */}
      <ellipse cx="-1" cy="-1" rx="2" ry="3" fill="#FFD34D" opacity="0.3"/>
      
      {/* Tech details: Hexagonal tech panels on body */}
      {showTechDetails && (
        <g opacity="0.4">
          {/* Tiny hex panels */}
          <path d="M-2.5 0 L-2 -0.5 L-1.5 -0.5 L-1 0 L-1.5 0.5 L-2 0.5 Z" fill="none" stroke="#00D4B3" strokeWidth="0.15"/>
          <path d="M1 0 L1.5 -0.5 L2 -0.5 L2.5 0 L2 0.5 L1.5 0.5 Z" fill="none" stroke="#00D4B3" strokeWidth="0.15"/>
          <path d="M-1 2.5 L-0.5 2 L0 2 L0.5 2.5 L0 3 L-0.5 3 Z" fill="none" stroke="#FFD34D" strokeWidth="0.15"/>
        </g>
      )}
      
      {/* Stripes - Bold with LED-style glow effects */}
      <rect x="-4" y="-1" width="8" height="1.5" rx="0.4" fill="#1a1a1a"/>
      <rect x="-4" y="1.2" width="8" height="1.5" rx="0.4" fill="#1a1a1a"/>
      <rect x="-4" y="3.4" width="8" height="1.5" rx="0.4" fill="#1a1a1a"/>
      
      {/* Tech details: LED stripe highlights with glow */}
      {showTechDetails ? (
        <>
          <rect x="-3.5" y="-0.7" width="7" height="0.4" rx="0.2" fill="#00D4B3" opacity="0.4"/>
          <rect x="-3.5" y="-0.8" width="7" height="0.2" rx="0.1" fill="#00D4B3" opacity="0.6"/>
          <rect x="-3.5" y="1.5" width="7" height="0.4" rx="0.2" fill="#00D4B3" opacity="0.4"/>
          <rect x="-3.5" y="1.4" width="7" height="0.2" rx="0.1" fill="#00D4B3" opacity="0.6"/>
        </>
      ) : (
        <>
          <rect x="-3.5" y="-0.7" width="7" height="0.4" rx="0.2" fill="#00D4B3" opacity="0.2"/>
          <rect x="-3.5" y="1.5" width="7" height="0.4" rx="0.2" fill="#00D4B3" opacity="0.2"/>
        </>
      )}
      
      {/* Head - Detailed with gradient */}
      <circle cx="0" cy="-6" r="3" fill="#1a1a1a"/>
      <circle cx="0" cy="-6" r="2.5" fill={`url(#${idPrefix}BodyGradient)`}/>
      
      {/* Face details */}
      <circle cx="-0.8" cy="-6.2" r="0.6" fill="#1a1a1a"/>
      <circle cx="0.8" cy="-6.2" r="0.6" fill="#1a1a1a"/>
      <circle cx="-0.8" cy="-6.2" r="0.3" fill="#00D4B3" opacity="0.8"/>
      <circle cx="0.8" cy="-6.2" r="0.3" fill="#00D4B3" opacity="0.8"/>
      
      {/* Smile */}
      <path d="M-1 -5.5 Q0 -5 1 -5.5" stroke="#1a1a1a" strokeWidth="0.4" fill="none" strokeLinecap="round"/>
      
      {/* Antennae - Professional with glow */}
      <g>
        <line x1="-1.2" y1="-8.5" x2="-2" y2="-11" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round"/>
        <line x1="1.2" y1="-8.5" x2="2" y2="-11" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round"/>
        
        {/* Antenna bulbs with gradient */}
        <circle cx="-2" cy="-11" r="1" fill="#00D4B3"/>
        <circle cx="2" cy="-11" r="1" fill="#00D4B3"/>
        <circle cx="-2" cy="-11" r="0.5" fill="#FFD34D" opacity="0.6"/>
        <circle cx="2" cy="-11" r="0.5" fill="#FFD34D" opacity="0.6"/>
      </g>
      
      {/* Tech sparkle accents and code symbols */}
      {showTechDetails ? (
        <>
          {/* Enhanced tech sparkles */}
          <circle cx="-5" cy="-5" r="0.5" fill="#00D4B3" opacity="0.8"/>
          <circle cx="5" cy="-5" r="0.5" fill="#00D4B3" opacity="0.8"/>
          <circle cx="-5" cy="-5" r="0.3" fill="#FFD34D" opacity="0.6"/>
          <circle cx="5" cy="-5" r="0.3" fill="#FFD34D" opacity="0.6"/>
          
          {/* Tiny code symbols */}
          <text x="-7" y="-6.5" fontSize="1.2" fill="#00D4B3" opacity="0.4" fontFamily="monospace">&lt;/&gt;</text>
          <text x="5.5" y="-6.5" fontSize="1.2" fill="#FFD34D" opacity="0.4" fontFamily="monospace">{'{}'}</text>
        </>
      ) : (
        <>
          <circle cx="-5" cy="-5" r="0.4" fill="#00D4B3" opacity="0.6"/>
          <circle cx="5" cy="-5" r="0.4" fill="#00D4B3" opacity="0.6"/>
        </>
      )}
    </g>
  );
}

// ============================================================================
// CORE PRIMITIVE: Wordmark (Reusable Text)
// ============================================================================
interface WordmarkProps {
  x?: number;
  y?: number;
  fontSize?: number;
  idPrefix?: string;
}

function Wordmark({ x = 0, y = 0, fontSize = 18, idPrefix = "wm" }: WordmarkProps) {
  return (
    <g>
      {/* "Beehive" text with gradient */}
      <text 
        x={x} 
        y={y} 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize={fontSize} 
        fontWeight="800" 
        fill={`url(#${idPrefix}TextGradient)`}
        letterSpacing="-0.8"
      >
        Beehive
      </text>
      
      {/* "AI" text with teal gradient */}
      <text 
        x={x + fontSize * 3.85} 
        y={y} 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize={fontSize} 
        fontWeight="800" 
        fill={`url(#${idPrefix}AiGradient)`}
        letterSpacing="-0.8"
      >
        AI
      </text>
      
      {/* Small accent dot */}
      <circle cx={x + fontSize * 3.75} cy={y - fontSize * 0.3} r={fontSize * 0.044} fill="#FFD34D" opacity="0.5"/>
    </g>
  );
}

// ============================================================================
// SHARED GRADIENTS
// ============================================================================
function SharedGradients({ idPrefix = "shared" }: { idPrefix?: string }) {
  return (
    <defs>
      <linearGradient id={`${idPrefix}HexGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD34D"/>
        <stop offset="100%" stopColor="#F7B500"/>
      </linearGradient>
      <linearGradient id={`${idPrefix}BodyGradient`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFD34D"/>
        <stop offset="50%" stopColor="#F7B500"/>
        <stop offset="100%" stopColor="#E5943C"/>
      </linearGradient>
      <linearGradient id={`${idPrefix}WingGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00D4B3" stopOpacity="0.8"/>
        <stop offset="100%" stopColor="#00B89E" stopOpacity="0.6"/>
      </linearGradient>
      <radialGradient id={`${idPrefix}GlowEffect`} cx="50%" cy="50%">
        <stop offset="0%" stopColor="#FFD34D" stopOpacity="0.3"/>
        <stop offset="100%" stopColor="#F7B500" stopOpacity="0"/>
      </radialGradient>
      <linearGradient id={`${idPrefix}TextGradient`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FFD34D"/>
        <stop offset="60%" stopColor="#F7B500"/>
      </linearGradient>
      <linearGradient id={`${idPrefix}AiGradient`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#00D4B3"/>
        <stop offset="100%" stopColor="#00B89E"/>
      </linearGradient>
    </defs>
  );
}

// ============================================================================
// PUBLIC API: Mobile Logo (Horizontal word+icon, 160x40)
// ============================================================================
export function SimplifiedMobileLogo({ className = "" }: { className?: string }) {
  const idPrefix = "mobile";
  
  return (
    <svg 
      viewBox="0 0 160 40" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`w-[160px] h-[40px] ${className}`}
      style={{ maxWidth: '160px', maxHeight: '40px' }}
    >
      <SharedGradients idPrefix={idPrefix} />
      
      {/* Hexagon Container */}
      <g>
        {/* Glow effect */}
        <ellipse cx="20" cy="20" rx="18" ry="18" fill={`url(#${idPrefix}GlowEffect)`} opacity="0.6"/>
        
        {/* Hexagon with gradient */}
        <path 
          d="M20 2 L33 10 L33 26 L20 34 L7 26 L7 10 Z" 
          fill={`url(#${idPrefix}HexGradient)`} 
          opacity="0.95"
        />
        
        {/* Hexagon borders */}
        <path 
          d="M20 2 L33 10 L33 26 L20 34 L7 26 L7 10 Z" 
          stroke="#00D4B3" 
          strokeWidth="1.5"
          fill="none"
          opacity="0.8"
        />
        <path 
          d="M20 3 L32 10.5 L32 25.5 L20 33 L8 25.5 L8 10.5 Z" 
          stroke="#101113" 
          strokeWidth="0.5"
          fill="none"
          opacity="0.4"
        />
        
        {/* Bee - Clean for mobile */}
        <BeeGlyph x={20} y={20} scale={1} idPrefix={idPrefix} showTechDetails={false} />
      </g>
      
      {/* Wordmark */}
      <Wordmark x={45} y={25} fontSize={18} idPrefix={idPrefix} />
      
      {/* Subtle underline */}
      <path 
        d="M45 28 L145 28" 
        stroke="#00D4B3" 
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}

// ============================================================================
// PUBLIC API: Desktop Logo (Horizontal word+icon, 400x100)
// ============================================================================
export function BeehiveLogo({ 
  size = "default",
  className = "" 
}: { 
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: { width: 240, height: 60, viewBox: "0 0 400 100", scale: 0.6 },
    default: { width: 400, height: 100, viewBox: "0 0 400 100", scale: 1 },
    lg: { width: 500, height: 120, viewBox: "0 0 400 100", scale: 1.2 }
  };
  
  const config = sizes[size];
  const idPrefix = `desktop${size}`;
  
  return (
    <svg 
      width={config.width}
      height={config.height}
      viewBox={config.viewBox}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <SharedGradients idPrefix={idPrefix} />
      
      {/* Hexagon Container */}
      <g transform="translate(15, 15)">
        {/* Glow effect */}
        <ellipse cx="35" cy="35" rx="42" ry="42" fill={`url(#${idPrefix}GlowEffect)`} opacity="0.5"/>
        
        {/* Hexagon with gradient */}
        <path 
          d="M35 2 L58 16 L58 54 L35 68 L12 54 L12 16 Z" 
          fill={`url(#${idPrefix}HexGradient)`} 
          opacity="0.95"
        />
        
        {/* Hexagon borders */}
        <path 
          d="M35 2 L58 16 L58 54 L35 68 L12 54 L12 16 Z" 
          stroke="#00D4B3" 
          strokeWidth="2"
          fill="none"
          opacity="0.8"
        />
        <path 
          d="M35 5 L56 18 L56 52 L35 65 L14 52 L14 18 Z" 
          stroke="#101113" 
          strokeWidth="1"
          fill="none"
          opacity="0.4"
        />
        
        {/* Bee - scaled up for desktop WITH tech details */}
        <BeeGlyph x={35} y={35} scale={1.8} idPrefix={idPrefix} showTechDetails={true} />
      </g>
      
      {/* Wordmark - scaled for desktop */}
      <Wordmark x={95} y={58} fontSize={36} idPrefix={idPrefix} />
      
      {/* Decorative hexagons */}
      <path d="M80 46 L84 49 L84 55 L80 58 L76 55 L76 49 Z" fill="#FFD34D" opacity="0.3" stroke="#F7B500" strokeWidth="1"/>
      <path d="M350 46 L354 49 L354 55 L350 58 L346 55 L346 49 Z" fill="#00D4B3" opacity="0.3" stroke="#00D4B3" strokeWidth="1"/>
      
      {/* Subtle underline */}
      <path 
        d="M95 65 L350 65" 
        stroke="#00D4B3" 
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}

// ============================================================================
// PUBLIC API: Icon Only (Hexagon with bee only, NO wordmark)
// ============================================================================
export function BeehiveIcon({ 
  size = 80, 
  className = "" 
}: { 
  size?: number; 
  className?: string;
}) {
  const idPrefix = `icon${size}`;
  // Calculate bee scale based on icon size (1.6 scale works well for 80px base)
  const beeScale = (size / 80) * 1.6;
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox={`0 0 ${size} ${size}`}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <SharedGradients idPrefix={idPrefix} />
      
      {/* Glow effect */}
      <ellipse cx={size/2} cy={size/2} rx={size*0.45} ry={size*0.45} fill={`url(#${idPrefix}GlowEffect)`} opacity="0.6"/>
      
      {/* Hexagon with gradient - scales with size */}
      <path 
        d={`M${size/2} ${size*0.05} L${size*0.825} ${size*0.2625} L${size*0.825} ${size*0.6875} L${size/2} ${size*0.9} L${size*0.175} ${size*0.6875} L${size*0.175} ${size*0.2625} Z`}
        fill={`url(#${idPrefix}HexGradient)`} 
        opacity="0.95"
      />
      
      {/* Hexagon borders */}
      <path 
        d={`M${size/2} ${size*0.05} L${size*0.825} ${size*0.2625} L${size*0.825} ${size*0.6875} L${size/2} ${size*0.9} L${size*0.175} ${size*0.6875} L${size*0.175} ${size*0.2625} Z`}
        stroke="#00D4B3" 
        strokeWidth={size * 0.025}
        fill="none"
        opacity="0.8"
      />
      <path 
        d={`M${size/2} ${size*0.075} L${size*0.8} ${size*0.275} L${size*0.8} ${size*0.675} L${size/2} ${size*0.875} L${size*0.2} ${size*0.675} L${size*0.2} ${size*0.275} Z`}
        stroke="#101113" 
        strokeWidth={size * 0.01}
        fill="none"
        opacity="0.4"
      />
      
      {/* Bee - centered, NO wordmark, clean at small sizes */}
      <BeeGlyph x={size/2} y={size/2} scale={beeScale} idPrefix={idPrefix} showTechDetails={size >= 64} />
    </svg>
  );
}
