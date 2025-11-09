// BeehiveAI Custom SVG Logos - Cyber Bee That Codes

// BeehiveIcon - Cyber Bee Coding at Terminal
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
      {/* Outer border ring - dark charcoal */}
      <circle 
        cx="60" 
        cy="60" 
        r="58" 
        stroke="#101113" 
        strokeWidth="3" 
        fill="none"
      />
      
      {/* Inner border ring - mint teal with glow */}
      <circle 
        cx="60" 
        cy="60" 
        r="54" 
        stroke="#00D4B3" 
        strokeWidth="2" 
        fill="none"
        opacity="0.8"
      />
      
      {/* Digital grid background */}
      <g opacity="0.1" stroke="#00D4B3" strokeWidth="0.5">
        <line x1="20" y1="30" x2="100" y2="30"/>
        <line x1="20" y1="45" x2="100" y2="45"/>
        <line x1="20" y1="60" x2="100" y2="60"/>
        <line x1="20" y1="75" x2="100" y2="75"/>
        <line x1="20" y1="90" x2="100" y2="90"/>
        <line x1="30" y1="20" x2="30" y2="100"/>
        <line x1="45" y1="20" x2="45" y2="100"/>
        <line x1="60" y1="20" x2="60" y2="100"/>
        <line x1="75" y1="20" x2="75" y2="100"/>
        <line x1="90" y1="20" x2="90" y2="100"/>
      </g>
      
      {/* Binary code decoration */}
      <g fill="#FFD34D" opacity="0.15" fontFamily="monospace" fontSize="6">
        <text x="25" y="25">01</text>
        <text x="85" y="25">10</text>
        <text x="25" y="95">11</text>
        <text x="85" y="95">00</text>
      </g>
      
      {/* Laptop/Terminal base */}
      <rect x="35" y="75" width="50" height="20" rx="2" fill="#101113" stroke="#00D4B3" strokeWidth="1.5"/>
      <rect x="37" y="77" width="46" height="16" fill="#1a1a1a"/>
      
      {/* Terminal screen with code */}
      <g fontFamily="monospace" fontSize="3.5" fill="#00D4B3">
        <text x="39" y="83">&lt;bee&gt;</text>
        <text x="39" y="87">code()</text>
        <text x="39" y="91">&lt;/bee&gt;</text>
      </g>
      
      {/* Cursor blink */}
      <rect x="65" y="88" width="1" height="3" fill="#00D4B3" opacity="0.8"/>
      
      {/* Cyber Bee - coding position */}
      <g id="cyberBee">
        {/* Main body - robotic with tech panels */}
        <ellipse cx="0" cy="0" rx="8" ry="10" fill="#FFD34D" stroke="#101113" strokeWidth="1.5"/>
        
        {/* Tech panels/stripes */}
        <rect x="-7" y="-4" width="14" height="2" fill="#101113" opacity="0.9"/>
        <rect x="-7" y="2" width="14" height="2" fill="#101113" opacity="0.9"/>
        
        {/* Circuit lines on body */}
        <g stroke="#00D4B3" strokeWidth="0.5" opacity="0.6">
          <line x1="-5" y1="-2" x2="5" y2="-2"/>
          <line x1="-5" y1="1" x2="5" y2="1"/>
          <circle cx="-4" cy="-2" r="0.5" fill="#00D4B3"/>
          <circle cx="4" cy="1" r="0.5" fill="#00D4B3"/>
        </g>
        
        {/* Hexagonal head with visor */}
        <path d="M0 -10 L4 -12 L8 -10 L8 -6 L4 -4 L0 -6 Z" fill="#F7B500" stroke="#101113" strokeWidth="1.2" transform="translate(-4, 0)"/>
        
        {/* Glowing visor - tech eyes */}
        <rect x="-5" y="-10" width="6" height="2" rx="1" fill="#00D4B3" opacity="0.9"/>
        <rect x="-4.5" y="-9.5" width="5" height="1" fill="#FFFFFF" opacity="0.5"/>
        
        {/* Antenna with sensor */}
        <line x1="-2" y1="-12" x2="-3" y2="-16" stroke="#101113" strokeWidth="0.8"/>
        <line x1="2" y1="-12" x2="3" y2="-16" stroke="#101113" strokeWidth="0.8"/>
        <circle cx="-3" cy="-16" r="1" fill="#00D4B3" stroke="#101113" strokeWidth="0.6"/>
        <circle cx="3" cy="-16" r="1" fill="#00D4B3" stroke="#101113" strokeWidth="0.6"/>
        
        {/* Tech wings - circuit board style */}
        <g opacity="0.7">
          <path d="M-8 -3 L-12 -5 L-14 -2 L-12 1 L-8 -1 Z" fill="#00D4B3" stroke="#101113" strokeWidth="0.8"/>
          <path d="M8 -3 L12 -5 L14 -2 L12 1 L8 -1 Z" fill="#00D4B3" stroke="#101113" strokeWidth="0.8"/>
          {/* Wing circuit traces */}
          <line x1="-10" y1="-4" x2="-12" y2="-2" stroke="#FFD34D" strokeWidth="0.4"/>
          <line x1="10" y1="-4" x2="12" y2="-2" stroke="#FFD34D" strokeWidth="0.4"/>
        </g>
        
        {/* Arms typing on keyboard */}
        <g stroke="#101113" strokeWidth="1.2" strokeLinecap="round" fill="none">
          <path d="M-7 4 L-10 8 L-8 10" />
          <path d="M7 4 L10 8 L8 10" />
        </g>
        
        {/* Robotic hands */}
        <circle cx="-8" cy="10" r="1.5" fill="#F7B500" stroke="#101113" strokeWidth="0.8"/>
        <circle cx="8" cy="10" r="1.5" fill="#F7B500" stroke="#101113" strokeWidth="0.8"/>
      </g>
      
      {/* Position cyber bee at laptop */}
      <use href="#cyberBee" transform="translate(60, 48)"/>
      
      {/* Code symbols floating around */}
      <g fill="#00D4B3" opacity="0.4" fontFamily="monospace" fontSize="8" fontWeight="bold">
        <text x="20" y="50">&lt;/&gt;</text>
        <text x="90" y="50">{'{}'}</text>
        <text x="20" y="70">[ ]</text>
        <text x="90" y="70">( )</text>
      </g>
      
      {/* Energy particles/data flow */}
      <g fill="#FFD34D" opacity="0.6">
        <circle cx="25" cy="35" r="1"/>
        <circle cx="95" cy="35" r="1"/>
        <circle cx="30" cy="65" r="1.5"/>
        <circle cx="90" cy="65" r="1.5"/>
      </g>
      
      {/* Glowing circuit traces connecting everything */}
      <g stroke="#00D4B3" strokeWidth="1" opacity="0.3" strokeLinecap="round">
        <path d="M30 30 L40 35"/>
        <path d="M90 30 L80 35"/>
        <path d="M30 70 L40 65"/>
        <path d="M90 70 L80 65"/>
      </g>
    </svg>
  );
}

// BeehiveLogo - Full horizontal logo with text
export function BeehiveLogo({ 
  size = "default",
  className = "" 
}: { 
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  // Size configurations
  const sizes = {
    sm: { width: 240, height: 60, scale: 0.75 },
    default: { width: 400, height: 100, scale: 1 },
    lg: { width: 500, height: 120, scale: 1.25 }
  };
  
  const config = sizes[size];
  
  return (
    <svg 
      width={config.width}
      height={config.height}
      viewBox="0 0 400 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Large Robot Bee Icon */}
      <g transform="translate(15, 15)">
        {/* Hexagonal border - robotic frame */}
        <path d="M35 2 L58 16 L58 54 L35 68 L12 54 L12 16 Z" stroke="#101113" strokeWidth="2.5" fill="none"/>
        <path d="M35 5 L56 18 L56 52 L35 65 L14 52 L14 18 Z" stroke="#00D4B3" strokeWidth="1.8" fill="none" opacity="0.9"/>
        
        {/* Digital grid background */}
        <g opacity="0.08" stroke="#00D4B3" strokeWidth="0.4">
          <line x1="10" y1="15" x2="60" y2="15"/>
          <line x1="10" y1="25" x2="60" y2="25"/>
          <line x1="10" y1="35" x2="60" y2="35"/>
          <line x1="10" y1="45" x2="60" y2="45"/>
          <line x1="10" y1="55" x2="60" y2="55"/>
          <line x1="15" y1="10" x2="15" y2="60"/>
          <line x1="25" y1="10" x2="25" y2="60"/>
          <line x1="35" y1="10" x2="35" y2="60"/>
          <line x1="45" y1="10" x2="45" y2="60"/>
          <line x1="55" y1="10" x2="55" y2="60"/>
        </g>
        
        {/* Animatronic Robot Bee - rendered directly */}
        <g transform="translate(35, 35)">
          {/* Body - segmented hexagonal armor plates */}
          <path d="M-5 -4 L5 -4 L7 0 L5 4 L-5 4 L-7 0 Z" fill="#1a1a1a" stroke="#101113" strokeWidth="1.2"/>
          <path d="M-4.5 -3.5 L4.5 -3.5 L6.5 0 L4.5 3.5 L-4.5 3.5 L-6.5 0 Z" fill="#F7B500" stroke="#00D4B3" strokeWidth="0.8"/>
          
          {/* Metal segmentation lines */}
          <line x1="-6" y1="-1" x2="6" y2="-1" stroke="#101113" strokeWidth="1.2"/>
          <line x1="-6" y1="1" x2="6" y2="1" stroke="#101113" strokeWidth="1.2"/>
          
          {/* Circuit board pattern */}
          <g stroke="#00D4B3" strokeWidth="0.4" fill="none">
            <rect x="-4" y="-2.5" width="2" height="1.5" rx="0.2"/>
            <rect x="2" y="-2.5" width="2" height="1.5" rx="0.2"/>
            <rect x="-4" y="1" width="2" height="1.5" rx="0.2"/>
            <rect x="2" y="1" width="2" height="1.5" rx="0.2"/>
            <line x1="-3" y1="-1.8" x2="3" y2="-1.8"/>
            <line x1="-3" y1="1.8" x2="3" y2="1.8"/>
            <circle cx="-1" cy="-1.8" r="0.3" fill="#00D4B3"/>
            <circle cx="1" cy="-1.8" r="0.3" fill="#00D4B3"/>
            <circle cx="-1" cy="1.8" r="0.3" fill="#00D4B3"/>
            <circle cx="1" cy="1.8" r="0.3" fill="#00D4B3"/>
          </g>
          
          {/* Hexagonal robotic head */}
          <path d="M-2 -7 L2 -9 L6 -7 L6 -3 L2 -1 L-2 -3 Z" fill="#2a2a2a" stroke="#101113" strokeWidth="1"/>
          <path d="M-1.5 -6.5 L2 -8.5 L5.5 -6.5 L5.5 -3.5 L2 -1.5 L-1.5 -3.5 Z" fill="#101113" stroke="#00D4B3" strokeWidth="0.6"/>
          
          {/* LED visor strip */}
          <rect x="-1" y="-6.5" width="5.5" height="1" rx="0.3" fill="#00D4B3"/>
          <rect x="-0.5" y="-6.2" width="5" height="0.4" rx="0.2" fill="#FFD34D" opacity="0.8"/>
          
          {/* Metal panel details */}
          <line x1="0" y1="-5" x2="0" y2="-4" stroke="#00D4B3" strokeWidth="0.3"/>
          <line x1="4" y1="-5" x2="4" y2="-4" stroke="#00D4B3" strokeWidth="0.3"/>
          
          {/* Antenna sensors - mechanical */}
          <g>
            <rect x="-2.5" y="-9.5" width="0.8" height="2.5" rx="0.2" fill="#1a1a1a" stroke="#101113" strokeWidth="0.5"/>
            <rect x="4.7" y="-9.5" width="0.8" height="2.5" rx="0.2" fill="#1a1a1a" stroke="#101113" strokeWidth="0.5"/>
            <rect x="-2.5" y="-11" width="0.8" height="1.5" fill="#00D4B3" stroke="#101113" strokeWidth="0.4"/>
            <rect x="4.7" y="-11" width="0.8" height="1.5" fill="#00D4B3" stroke="#101113" strokeWidth="0.4"/>
            <circle cx="-2.1" cy="-10.3" r="0.25" fill="#FFD34D"/>
            <circle cx="5.1" cy="-10.3" r="0.25" fill="#FFD34D"/>
          </g>
          
          {/* Mechanical wings - angular tech panels */}
          <g>
            <path d="M-7 -2 L-11 -4.5 L-12 -2 L-11 0.5 L-7 -0.5 Z" fill="#1a1a1a" stroke="#101113" strokeWidth="0.8"/>
            <path d="M-7.5 -2 L-10.5 -4 L-11.5 -2 L-10.5 0.2 L-7.5 -0.5 Z" fill="#00D4B3" opacity="0.6" stroke="#00D4B3" strokeWidth="0.4"/>
            <line x1="-9" y1="-3" x2="-9" y2="-1" stroke="#FFD34D" strokeWidth="0.3"/>
            
            <path d="M7 -2 L11 -4.5 L12 -2 L11 0.5 L7 -0.5 Z" fill="#1a1a1a" stroke="#101113" strokeWidth="0.8"/>
            <path d="M7.5 -2 L10.5 -4 L11.5 -2 L10.5 0.2 L7.5 -0.5 Z" fill="#00D4B3" opacity="0.6" stroke="#00D4B3" strokeWidth="0.4"/>
            <line x1="9" y1="-3" x2="9" y2="-1" stroke="#FFD34D" strokeWidth="0.3"/>
          </g>
          
          {/* Mechanical arms with joints */}
          <g>
            <rect x="-6.5" y="3" width="1.2" height="3" rx="0.3" fill="#1a1a1a" stroke="#101113" strokeWidth="0.7"/>
            <rect x="5.3" y="3" width="1.2" height="3" rx="0.3" fill="#1a1a1a" stroke="#101113" strokeWidth="0.7"/>
            <circle cx="-5.9" cy="4.2" r="0.4" fill="#00D4B3" stroke="#101113" strokeWidth="0.3"/>
            <circle cx="5.9" cy="4.2" r="0.4" fill="#00D4B3" stroke="#101113" strokeWidth="0.3"/>
            <rect x="-7" y="6" width="2" height="1.5" rx="0.3" fill="#F7B500" stroke="#101113" strokeWidth="0.6"/>
            <rect x="5" y="6" width="2" height="1.5" rx="0.3" fill="#F7B500" stroke="#101113" strokeWidth="0.6"/>
            <circle cx="-6" cy="6.7" r="0.35" fill="#00D4B3"/>
            <circle cx="6" cy="6.7" r="0.35" fill="#00D4B3"/>
          </g>
        </g>
        
        {/* Floating code symbols around bee */}
        <g fill="#00D4B3" opacity="0.35" fontFamily="monospace" fontSize="6" fontWeight="bold">
          <text x="8" y="30">&lt;/&gt;</text>
          <text x="54" y="30">{'{}'}</text>
          <text x="8" y="50">[ ]</text>
          <text x="54" y="50">( )</text>
        </g>
        
        {/* Energy particles */}
        <g fill="#FFD34D" opacity="0.7">
          <circle cx="12" cy="20" r="1"/>
          <circle cx="58" cy="20" r="1"/>
          <circle cx="12" cy="50" r="1.2"/>
          <circle cx="58" cy="50" r="1.2"/>
        </g>
      </g>
      
      {/* Decorative elements and enhancements */}
      
      {/* Subtle glow capsule behind text */}
      <ellipse cx="160" cy="42" rx="150" ry="30" fill="url(#glowGradient)" opacity="0.15"/>
      
      {/* Decorative hexagons flanking the text */}
      <path d="M60 38 L64 41 L64 47 L60 50 L56 47 L56 41 Z" fill="#FFD34D" opacity="0.3" stroke="#F7B500" strokeWidth="1"/>
      <path d="M260 38 L264 41 L264 47 L260 50 L256 47 L256 41 Z" fill="#00D4B3" opacity="0.3" stroke="#00D4B3" strokeWidth="1"/>
      
      {/* Sparkles for energy */}
      <g fill="#FFD34D" opacity="0.6">
        <polygon points="70,32 71,34 73,35 71,36 70,38 69,36 67,35 69,34"/>
        <polygon points="252,32 253,34 255,35 253,36 252,38 251,36 249,35 251,34"/>
      </g>
      <g fill="#00D4B3" opacity="0.6">
        <polygon points="215,28 216,30 218,31 216,32 215,34 214,32 212,31 214,30"/>
      </g>
      
      {/* Main text - Beehive */}
      <text 
        x="75" 
        y="50" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="36" 
        fontWeight="900" 
        fill="url(#textGradient)"
        letterSpacing="-1.5"
      >
        Beehive
      </text>
      
      {/* Honey trail underline beneath Beehive */}
      <path d="M75 55 Q145 52 215 55" stroke="#F7B500" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5"/>
      <circle cx="80" cy="55" r="2" fill="#FFD34D" opacity="0.7"/>
      <circle cx="140" cy="53" r="1.5" fill="#FFD34D" opacity="0.6"/>
      <circle cx="200" cy="55" r="2" fill="#FFD34D" opacity="0.7"/>
      
      {/* AI text with mint accent */}
      <text 
        x="220" 
        y="50" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="36" 
        fontWeight="900" 
        fill="#00D4B3"
        letterSpacing="-1.5"
      >
        AI
      </text>
      
      {/* Mint accent stroke on AI */}
      <text 
        x="220" 
        y="50" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="36" 
        fontWeight="900" 
        fill="none"
        stroke="#00D4B3"
        strokeWidth="0.5"
        letterSpacing="-1.5"
        opacity="0.5"
      >
        AI
      </text>
      
      {/* Gradients */}
      <defs>
        <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E5943C"/>
          <stop offset="50%" stopColor="#F7B500"/>
          <stop offset="100%" stopColor="#FFD34D"/>
        </linearGradient>
        <radialGradient id="glowGradient" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#FFD34D"/>
          <stop offset="100%" stopColor="#F7B500"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

// Mobile Logo - Compact version
export function BeehiveLogoMobile({ 
  size = "sm",
  className = "" 
}: { 
  size?: "sm" | "default";
  className?: string;
}) {
  const sizes = {
    sm: { width: 240, height: 60 },
    default: { width: 280, height: 70 }
  };
  
  const config = sizes[size];
  
  return (
    <svg 
      width={config.width}
      height={config.height}
      viewBox="0 0 240 60" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Large Robot Bee Icon Mobile */}
      <g transform="translate(8, 8)">
        {/* Hexagonal border - robotic frame */}
        <path d="M22 1 L37 10 L37 34 L22 43 L7 34 L7 10 Z" stroke="#101113" strokeWidth="1.6" fill="none"/>
        <path d="M22 3 L35 11 L35 33 L22 41 L9 33 L9 11 Z" stroke="#00D4B3" strokeWidth="1.1" fill="none" opacity="0.9"/>
        
        {/* Digital grid background */}
        <g opacity="0.06" stroke="#00D4B3" strokeWidth="0.25">
          <line x1="7" y1="10" x2="37" y2="10"/>
          <line x1="7" y1="16" x2="37" y2="16"/>
          <line x1="7" y1="22" x2="37" y2="22"/>
          <line x1="7" y1="28" x2="37" y2="28"/>
          <line x1="7" y1="34" x2="37" y2="34"/>
          <line x1="10" y1="7" x2="10" y2="37"/>
          <line x1="16" y1="7" x2="16" y2="37"/>
          <line x1="22" y1="7" x2="22" y2="37"/>
          <line x1="28" y1="7" x2="28" y2="37"/>
          <line x1="34" y1="7" x2="34" y2="37"/>
        </g>
        
        {/* Animatronic Robot Bee Mobile - rendered directly */}
        <g transform="translate(22, 22)">
          {/* Body - segmented hexagonal armor plates */}
          <path d="M-3.2 -2.5 L3.2 -2.5 L4.5 0 L3.2 2.5 L-3.2 2.5 L-4.5 0 Z" fill="#1a1a1a" stroke="#101113" strokeWidth="0.8"/>
          <path d="M-2.9 -2.2 L2.9 -2.2 L4.2 0 L2.9 2.2 L-2.9 2.2 L-4.2 0 Z" fill="#F7B500" stroke="#00D4B3" strokeWidth="0.5"/>
          
          {/* Metal segmentation lines */}
          <line x1="-4" y1="-0.6" x2="4" y2="-0.6" stroke="#101113" strokeWidth="0.8"/>
          <line x1="-4" y1="0.6" x2="4" y2="0.6" stroke="#101113" strokeWidth="0.8"/>
          
          {/* Circuit board pattern */}
          <g stroke="#00D4B3" strokeWidth="0.25" fill="none">
            <rect x="-2.5" y="-1.5" width="1.2" height="0.9" rx="0.1"/>
            <rect x="1.3" y="-1.5" width="1.2" height="0.9" rx="0.1"/>
            <rect x="-2.5" y="0.6" width="1.2" height="0.9" rx="0.1"/>
            <rect x="1.3" y="0.6" width="1.2" height="0.9" rx="0.1"/>
            <line x1="-2" y1="-1.1" x2="2" y2="-1.1"/>
            <line x1="-2" y1="1.1" x2="2" y2="1.1"/>
            <circle cx="-0.6" cy="-1.1" r="0.2" fill="#00D4B3"/>
            <circle cx="0.6" cy="-1.1" r="0.2" fill="#00D4B3"/>
            <circle cx="-0.6" cy="1.1" r="0.2" fill="#00D4B3"/>
            <circle cx="0.6" cy="1.1" r="0.2" fill="#00D4B3"/>
          </g>
          
          {/* Hexagonal robotic head */}
          <path d="M-1.3 -4.5 L1.3 -5.8 L4 -4.5 L4 -2 L1.3 -0.6 L-1.3 -2 Z" fill="#2a2a2a" stroke="#101113" strokeWidth="0.6"/>
          <path d="M-1 -4.2 L1.3 -5.3 L3.7 -4.2 L3.7 -2.3 L1.3 -1 L-1 -2.3 Z" fill="#101113" stroke="#00D4B3" strokeWidth="0.4"/>
          
          {/* LED visor strip */}
          <rect x="-0.6" y="-4.2" width="3.5" height="0.6" rx="0.2" fill="#00D4B3"/>
          <rect x="-0.3" y="-4" width="3.2" height="0.25" rx="0.1" fill="#FFD34D" opacity="0.8"/>
          
          {/* Metal panel details */}
          <line x1="0.2" y1="-3.2" x2="0.2" y2="-2.6" stroke="#00D4B3" strokeWidth="0.2"/>
          <line x1="2.6" y1="-3.2" x2="2.6" y2="-2.6" stroke="#00D4B3" strokeWidth="0.2"/>
          
          {/* Antenna sensors - mechanical */}
          <g>
            <rect x="-1.6" y="-6.1" width="0.5" height="1.6" rx="0.1" fill="#1a1a1a" stroke="#101113" strokeWidth="0.3"/>
            <rect x="3.1" y="-6.1" width="0.5" height="1.6" rx="0.1" fill="#1a1a1a" stroke="#101113" strokeWidth="0.3"/>
            <rect x="-1.6" y="-7.1" width="0.5" height="1" fill="#00D4B3" stroke="#101113" strokeWidth="0.25"/>
            <rect x="3.1" y="-7.1" width="0.5" height="1" fill="#00D4B3" stroke="#101113" strokeWidth="0.25"/>
            <circle cx="-1.35" cy="-6.6" r="0.15" fill="#FFD34D"/>
            <circle cx="3.35" cy="-6.6" r="0.15" fill="#FFD34D"/>
          </g>
          
          {/* Mechanical wings - angular tech panels */}
          <g>
            <path d="M-4.5 -1.3 L-7.1 -2.9 L-7.7 -1.3 L-7.1 0.3 L-4.5 -0.3 Z" fill="#1a1a1a" stroke="#101113" strokeWidth="0.5"/>
            <path d="M-4.8 -1.3 L-6.8 -2.6 L-7.4 -1.3 L-6.8 0.1 L-4.8 -0.3 Z" fill="#00D4B3" opacity="0.6" stroke="#00D4B3" strokeWidth="0.25"/>
            <line x1="-5.8" y1="-1.9" x2="-5.8" y2="-0.6" stroke="#FFD34D" strokeWidth="0.2"/>
            
            <path d="M4.5 -1.3 L7.1 -2.9 L7.7 -1.3 L7.1 0.3 L4.5 -0.3 Z" fill="#1a1a1a" stroke="#101113" strokeWidth="0.5"/>
            <path d="M4.8 -1.3 L6.8 -2.6 L7.4 -1.3 L6.8 0.1 L4.8 -0.3 Z" fill="#00D4B3" opacity="0.6" stroke="#00D4B3" strokeWidth="0.25"/>
            <line x1="5.8" y1="-1.9" x2="5.8" y2="-0.6" stroke="#FFD34D" strokeWidth="0.2"/>
          </g>
          
          {/* Mechanical arms with joints */}
          <g>
            <rect x="-4.2" y="1.9" width="0.8" height="1.9" rx="0.2" fill="#1a1a1a" stroke="#101113" strokeWidth="0.45"/>
            <rect x="3.4" y="1.9" width="0.8" height="1.9" rx="0.2" fill="#1a1a1a" stroke="#101113" strokeWidth="0.45"/>
            <circle cx="-3.8" cy="2.7" r="0.25" fill="#00D4B3" stroke="#101113" strokeWidth="0.2"/>
            <circle cx="3.8" cy="2.7" r="0.25" fill="#00D4B3" stroke="#101113" strokeWidth="0.2"/>
            <rect x="-4.5" y="3.8" width="1.3" height="1" rx="0.2" fill="#F7B500" stroke="#101113" strokeWidth="0.4"/>
            <rect x="3.2" y="3.8" width="1.3" height="1" rx="0.2" fill="#F7B500" stroke="#101113" strokeWidth="0.4"/>
            <circle cx="-3.9" cy="4.3" r="0.22" fill="#00D4B3"/>
            <circle cx="3.9" cy="4.3" r="0.22" fill="#00D4B3"/>
          </g>
        </g>
        
        {/* Floating code symbols around bee */}
        <g fill="#00D4B3" opacity="0.3" fontFamily="monospace" fontSize="3.8" fontWeight="bold">
          <text x="5" y="18">&lt;/&gt;</text>
          <text x="34" y="18">{'{}'}</text>
          <text x="5" y="32">[ ]</text>
          <text x="34" y="32">( )</text>
        </g>
        
        {/* Energy particles */}
        <g fill="#FFD34D" opacity="0.7">
          <circle cx="8" cy="12" r="0.6"/>
          <circle cx="36" cy="12" r="0.6"/>
          <circle cx="8" cy="32" r="0.8"/>
          <circle cx="36" cy="32" r="0.8"/>
        </g>
      </g>
      
      {/* Decorative elements - mobile */}
      
      {/* Subtle glow behind text */}
      <ellipse cx="105" cy="28" rx="85" ry="18" fill="url(#glowGradientMobile)" opacity="0.12"/>
      
      {/* Decorative hexagons */}
      <path d="M42 24 L44 26 L44 30 L42 32 L40 30 L40 26 Z" fill="#FFD34D" opacity="0.3" stroke="#F7B500" strokeWidth="0.7"/>
      <path d="M168 24 L170 26 L170 30 L168 32 L166 30 L166 26 Z" fill="#00D4B3" opacity="0.3" stroke="#00D4B3" strokeWidth="0.7"/>
      
      {/* Sparkles */}
      <g fill="#FFD34D" opacity="0.6">
        <polygon points="46,20 47,21 48,22 47,23 46,24 45,23 44,22 45,21"/>
        <polygon points="164,20 165,21 166,22 165,23 164,24 163,23 162,22 163,21"/>
      </g>
      <g fill="#00D4B3" opacity="0.6">
        <polygon points="136,18 137,19 138,20 137,21 136,22 135,21 134,20 135,19"/>
      </g>
      
      {/* Text - Beehive */}
      <text 
        x="50" 
        y="32" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="24" 
        fontWeight="900" 
        fill="url(#textGradientMobile)"
        letterSpacing="-1"
      >
        Beehive
      </text>
      
      {/* Honey trail underline */}
      <path d="M50 36 Q90 34 130 36" stroke="#F7B500" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5"/>
      <circle cx="54" cy="36" r="1.2" fill="#FFD34D" opacity="0.7"/>
      <circle cx="90" cy="35" r="0.8" fill="#FFD34D" opacity="0.6"/>
      <circle cx="124" cy="36" r="1.2" fill="#FFD34D" opacity="0.7"/>
      
      {/* Text - AI */}
      <text 
        x="140" 
        y="32" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="24" 
        fontWeight="900" 
        fill="#00D4B3"
        letterSpacing="-1"
      >
        AI
      </text>
      
      {/* Mint accent stroke */}
      <text 
        x="140" 
        y="32" 
        fontFamily="Inter, system-ui, -apple-system, sans-serif" 
        fontSize="24" 
        fontWeight="900" 
        fill="none"
        stroke="#00D4B3"
        strokeWidth="0.4"
        letterSpacing="-1"
        opacity="0.5"
      >
        AI
      </text>
      
      <defs>
        <linearGradient id="textGradientMobile" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E5943C"/>
          <stop offset="50%" stopColor="#F7B500"/>
          <stop offset="100%" stopColor="#FFD34D"/>
        </linearGradient>
        <radialGradient id="glowGradientMobile" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#FFD34D"/>
          <stop offset="100%" stopColor="#F7B500"/>
        </radialGradient>
      </defs>
    </svg>
  );
}
