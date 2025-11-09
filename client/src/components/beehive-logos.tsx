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
      {/* Icon - compact version with robot bees */}
      <g transform="translate(10, 10)">
        {/* Border circles */}
        <circle cx="30" cy="30" r="28" stroke="#101113" strokeWidth="2" fill="none"/>
        <circle cx="30" cy="30" r="26" stroke="#00D4B3" strokeWidth="1.5" fill="none" opacity="0.6"/>
        
        {/* Subtle honeycomb pattern background */}
        <g opacity="0.15" stroke="#FFD34D" strokeWidth="0.6" fill="none">
          {/* Center */}
          <path d="M30 20 L34 23 L34 29 L30 32 L26 29 L26 23 Z"/>
          {/* Top left */}
          <path d="M22 15 L26 18 L26 24 L22 27 L18 24 L18 18 Z"/>
          {/* Top right */}
          <path d="M38 15 L42 18 L42 24 L38 27 L34 24 L34 18 Z"/>
          {/* Middle left */}
          <path d="M18 27 L22 30 L22 36 L18 39 L14 36 L14 30 Z"/>
          {/* Middle right */}
          <path d="M42 27 L46 30 L46 36 L42 39 L38 36 L38 30 Z"/>
          {/* Bottom left */}
          <path d="M22 39 L26 42 L26 48 L22 51 L18 48 L18 42 Z"/>
          {/* Bottom right */}
          <path d="M38 39 L42 42 L42 48 L38 51 L34 48 L34 42 Z"/>
        </g>
        
        {/* Central hive */}
        <defs>
          <linearGradient id="hiveGradientLogo" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E8E8E8"/>
            <stop offset="50%" stopColor="#B0B0B0"/>
            <stop offset="100%" stopColor="#808080"/>
          </linearGradient>
        </defs>
        
        <ellipse cx="30" cy="30" rx="11" ry="13" fill="url(#hiveGradientLogo)" stroke="#101113" strokeWidth="1.5"/>
        
        {/* Hive bands */}
        <ellipse cx="30" cy="24" rx="11" ry="1.5" fill="#C0C0C0" opacity="0.5"/>
        <ellipse cx="30" cy="28" rx="11" ry="1.5" fill="#A0A0A0" opacity="0.5"/>
        <ellipse cx="30" cy="32" rx="11" ry="1.5" fill="#909090" opacity="0.5"/>
        <ellipse cx="30" cy="36" rx="11" ry="1.5" fill="#808080" opacity="0.5"/>
        
        {/* Central hexagon */}
        <path d="M30 27 L33 29 L33 33 L30 35 L27 33 L27 29 Z" fill="#00D4B3" stroke="#101113" strokeWidth="0.8"/>
        
        {/* Cute bee mini */}
        <g id="miniBee">
          <ellipse cx="0" cy="0.3" rx="1.8" ry="2.3" fill="#FFD34D" stroke="#101113" strokeWidth="0.4"/>
          <ellipse cx="0" cy="-0.5" rx="1.6" ry="0.6" fill="#101113"/>
          <ellipse cx="0" cy="0.8" rx="1.6" ry="0.6" fill="#101113"/>
          <circle cx="0" cy="-1.5" r="1.1" fill="#F7B500" stroke="#101113" strokeWidth="0.35"/>
          <circle cx="-0.4" cy="-1.5" r="0.3" fill="#101113"/>
          <circle cx="0.4" cy="-1.5" r="0.3" fill="#101113"/>
          <circle cx="-0.3" cy="-1.6" r="0.15" fill="#FFFFFF"/>
          <circle cx="0.3" cy="-1.6" r="0.15" fill="#FFFFFF"/>
          <path d="M-0.7 -2.5 L-1 -3.3" stroke="#101113" strokeWidth="0.25" strokeLinecap="round"/>
          <path d="M0.7 -2.5 L1 -3.3" stroke="#101113" strokeWidth="0.25" strokeLinecap="round"/>
          <circle cx="-1" cy="-3.3" r="0.25" fill="#F7B500" stroke="#101113" strokeWidth="0.2"/>
          <circle cx="1" cy="-3.3" r="0.25" fill="#F7B500" stroke="#101113" strokeWidth="0.2"/>
          <ellipse cx="-1.3" cy="-0.5" rx="1.4" ry="1.8" fill="#00D4B3" opacity="0.5" stroke="#00D4B3" strokeWidth="0.3"/>
          <ellipse cx="1.3" cy="-0.5" rx="1.4" ry="1.8" fill="#00D4B3" opacity="0.5" stroke="#00D4B3" strokeWidth="0.3"/>
          <ellipse cx="-1.2" cy="-0.3" rx="0.7" ry="1" fill="#FFFFFF" opacity="0.6"/>
          <ellipse cx="1.2" cy="-0.3" rx="0.7" ry="1" fill="#FFFFFF" opacity="0.6"/>
        </g>
        
        {/* Position mini bees */}
        <use href="#miniBee" transform="translate(30, 10)"/>
        <use href="#miniBee" transform="translate(44, 16)"/>
        <use href="#miniBee" transform="translate(49, 30)"/>
        <use href="#miniBee" transform="translate(44, 44)"/>
        <use href="#miniBee" transform="translate(30, 50)"/>
        <use href="#miniBee" transform="translate(16, 44)"/>
        <use href="#miniBee" transform="translate(11, 30)"/>
        <use href="#miniBee" transform="translate(16, 16)"/>
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
      {/* Icon - small version with robot bees */}
      <g transform="translate(5, 5)">
        {/* Border circles */}
        <circle cx="20" cy="20" r="19" stroke="#101113" strokeWidth="1.5" fill="none"/>
        <circle cx="20" cy="20" r="17.5" stroke="#00D4B3" strokeWidth="1" fill="none" opacity="0.6"/>
        
        {/* Subtle honeycomb pattern background */}
        <g opacity="0.15" stroke="#FFD34D" strokeWidth="0.5" fill="none">
          {/* Center */}
          <path d="M20 13 L23 15 L23 19 L20 21 L17 19 L17 15 Z"/>
          {/* Top left */}
          <path d="M14 10 L17 12 L17 16 L14 18 L11 16 L11 12 Z"/>
          {/* Top right */}
          <path d="M26 10 L29 12 L29 16 L26 18 L23 16 L23 12 Z"/>
          {/* Middle left */}
          <path d="M11 18 L14 20 L14 24 L11 26 L8 24 L8 20 Z"/>
          {/* Middle right */}
          <path d="M29 18 L32 20 L32 24 L29 26 L26 24 L26 20 Z"/>
          {/* Bottom left */}
          <path d="M14 26 L17 28 L17 32 L14 34 L11 32 L11 28 Z"/>
          {/* Bottom right */}
          <path d="M26 26 L29 28 L29 32 L26 34 L23 32 L23 28 Z"/>
        </g>
        
        {/* Central hive */}
        <defs>
          <linearGradient id="hiveGradientMobile" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E8E8E8"/>
            <stop offset="50%" stopColor="#B0B0B0"/>
            <stop offset="100%" stopColor="#808080"/>
          </linearGradient>
        </defs>
        
        <ellipse cx="20" cy="20" rx="7.5" ry="9" fill="url(#hiveGradientMobile)" stroke="#101113" strokeWidth="1"/>
        
        {/* Hive bands */}
        <ellipse cx="20" cy="16" rx="7.5" ry="1" fill="#C0C0C0" opacity="0.5"/>
        <ellipse cx="20" cy="19" rx="7.5" ry="1" fill="#A0A0A0" opacity="0.5"/>
        <ellipse cx="20" cy="22" rx="7.5" ry="1" fill="#909090" opacity="0.5"/>
        <ellipse cx="20" cy="25" rx="7.5" ry="1" fill="#808080" opacity="0.5"/>
        
        {/* Central hexagon */}
        <path d="M20 18 L22 19.5 L22 22.5 L20 24 L18 22.5 L18 19.5 Z" fill="#00D4B3" stroke="#101113" strokeWidth="0.5"/>
        
        {/* Tiny cute bee */}
        <g id="tinyBee">
          <ellipse cx="0" cy="0.2" rx="1.2" ry="1.5" fill="#FFD34D" stroke="#101113" strokeWidth="0.3"/>
          <ellipse cx="0" cy="-0.3" rx="1.1" ry="0.4" fill="#101113"/>
          <ellipse cx="0" cy="0.5" rx="1.1" ry="0.4" fill="#101113"/>
          <circle cx="0" cy="-1" r="0.7" fill="#F7B500" stroke="#101113" strokeWidth="0.25"/>
          <circle cx="-0.3" cy="-1" r="0.2" fill="#101113"/>
          <circle cx="0.3" cy="-1" r="0.2" fill="#101113"/>
          <circle cx="-0.2" cy="-1.1" r="0.1" fill="#FFFFFF"/>
          <circle cx="0.2" cy="-1.1" r="0.1" fill="#FFFFFF"/>
          <path d="M-0.5 -1.6 L-0.7 -2.2" stroke="#101113" strokeWidth="0.2" strokeLinecap="round"/>
          <path d="M0.5 -1.6 L0.7 -2.2" stroke="#101113" strokeWidth="0.2" strokeLinecap="round"/>
          <circle cx="-0.7" cy="-2.2" r="0.15" fill="#F7B500" stroke="#101113" strokeWidth="0.15"/>
          <circle cx="0.7" cy="-2.2" r="0.15" fill="#F7B500" stroke="#101113" strokeWidth="0.15"/>
          <ellipse cx="-0.9" cy="-0.3" rx="0.9" ry="1.2" fill="#00D4B3" opacity="0.5" stroke="#00D4B3" strokeWidth="0.2"/>
          <ellipse cx="0.9" cy="-0.3" rx="0.9" ry="1.2" fill="#00D4B3" opacity="0.5" stroke="#00D4B3" strokeWidth="0.2"/>
          <ellipse cx="-0.8" cy="-0.2" rx="0.5" ry="0.7" fill="#FFFFFF" opacity="0.6"/>
          <ellipse cx="0.8" cy="-0.2" rx="0.5" ry="0.7" fill="#FFFFFF" opacity="0.6"/>
        </g>
        
        {/* Position tiny bees - fewer for mobile */}
        <use href="#tinyBee" transform="translate(20, 7)"/>
        <use href="#tinyBee" transform="translate(30, 12)"/>
        <use href="#tinyBee" transform="translate(33, 20)"/>
        <use href="#tinyBee" transform="translate(30, 28)"/>
        <use href="#tinyBee" transform="translate(20, 33)"/>
        <use href="#tinyBee" transform="translate(10, 28)"/>
        <use href="#tinyBee" transform="translate(7, 20)"/>
        <use href="#tinyBee" transform="translate(10, 12)"/>
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
