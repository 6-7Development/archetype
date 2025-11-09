// BeehiveAI Custom SVG Logos - Robot Bees + Tech Hive Design

// BeehiveIcon - Robot Bees Around Tech Hive
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
      
      {/* Inner border ring - mint teal */}
      <circle 
        cx="60" 
        cy="60" 
        r="54" 
        stroke="#00D4B3" 
        strokeWidth="2" 
        fill="none"
        opacity="0.6"
      />
      
      {/* Subtle honeycomb pattern background */}
      <g opacity="0.15" stroke="#FFD34D" strokeWidth="0.8" fill="none">
        {/* Center row */}
        <path d="M60 35 L68 40 L68 50 L60 55 L52 50 L52 40 Z"/>
        
        {/* Top left */}
        <path d="M44 25 L52 30 L52 40 L44 45 L36 40 L36 30 Z"/>
        {/* Top */}
        <path d="M60 15 L68 20 L68 30 L60 35 L52 30 L52 20 Z"/>
        {/* Top right */}
        <path d="M76 25 L84 30 L84 40 L76 45 L68 40 L68 30 Z"/>
        
        {/* Middle left */}
        <path d="M36 45 L44 50 L44 60 L36 65 L28 60 L28 50 Z"/>
        {/* Middle right */}
        <path d="M84 45 L92 50 L92 60 L84 65 L76 60 L76 50 Z"/>
        
        {/* Bottom left */}
        <path d="M44 65 L52 70 L52 80 L44 85 L36 80 L36 70 Z"/>
        {/* Bottom */}
        <path d="M60 75 L68 80 L68 90 L60 95 L52 90 L52 80 Z"/>
        {/* Bottom right */}
        <path d="M76 65 L84 70 L84 80 L76 85 L68 80 L68 70 Z"/>
      </g>
      
      {/* Central tech hive - metallic dome with circuit patterns */}
      <defs>
        <linearGradient id="hiveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8E8E8"/>
          <stop offset="40%" stopColor="#C0C0C0"/>
          <stop offset="80%" stopColor="#A0A0A0"/>
          <stop offset="100%" stopColor="#808080"/>
        </linearGradient>
      </defs>
      
      {/* Hive body - dome shape with layers */}
      <ellipse cx="60" cy="60" rx="22" ry="26" fill="url(#hiveGradient)" stroke="#101113" strokeWidth="2"/>
      
      {/* Hive horizontal bands */}
      <ellipse cx="60" cy="48" rx="22" ry="3" fill="#C0C0C0" opacity="0.5"/>
      <ellipse cx="60" cy="56" rx="22" ry="3" fill="#A0A0A0" opacity="0.5"/>
      <ellipse cx="60" cy="64" rx="22" ry="3" fill="#909090" opacity="0.5"/>
      <ellipse cx="60" cy="72" rx="22" ry="3" fill="#808080" opacity="0.5"/>
      
      {/* Central hexagon circuit element */}
      <path 
        d="M60 54 L66 58 L66 66 L60 70 L54 66 L54 58 Z" 
        fill="#00D4B3" 
        stroke="#101113" 
        strokeWidth="1.5"
      />
      
      {/* Circuit nodes on hive */}
      <g fill="#00D4B3" stroke="#101113" strokeWidth="1">
        <circle cx="50" cy="60" r="2"/>
        <circle cx="70" cy="60" r="2"/>
        <circle cx="60" cy="50" r="2"/>
        <circle cx="60" cy="70" r="2"/>
      </g>
      
      {/* Circuit traces on hive */}
      <g stroke="#00D4B3" strokeWidth="1.5" opacity="0.8">
        <line x1="54" y1="58" x2="50" y2="60"/>
        <line x1="66" y1="58" x2="70" y2="60"/>
        <line x1="60" y1="54" x2="60" y2="50"/>
        <line x1="60" y1="70" x2="60" y2="70"/>
      </g>
      
      {/* Cute Bee Component - emoji-style */}
      <g id="robotBee">
        {/* Main body - round golden yellow */}
        <ellipse cx="0" cy="0.5" rx="3.5" ry="4.5" fill="#FFD34D" stroke="#101113" strokeWidth="0.8"/>
        
        {/* Black stripes - bee-like */}
        <ellipse cx="0" cy="-1" rx="3.2" ry="1.2" fill="#101113"/>
        <ellipse cx="0" cy="1.5" rx="3.2" ry="1.2" fill="#101113"/>
        
        {/* Head - round */}
        <circle cx="0" cy="-3" r="2.2" fill="#F7B500" stroke="#101113" strokeWidth="0.7"/>
        
        {/* Cute eyes */}
        <circle cx="-0.8" cy="-3" r="0.6" fill="#101113"/>
        <circle cx="0.8" cy="-3" r="0.6" fill="#101113"/>
        <circle cx="-0.6" cy="-3.2" r="0.3" fill="#FFFFFF"/>
        <circle cx="0.6" cy="-3.2" r="0.3" fill="#FFFFFF"/>
        
        {/* Cute smile */}
        <path d="M-0.8 -2.2 Q0 -1.8 0.8 -2.2" stroke="#101113" strokeWidth="0.4" fill="none" strokeLinecap="round"/>
        
        {/* Antennae */}
        <path d="M-0.8 -5 L-1.5 -6.5" stroke="#101113" strokeWidth="0.5" strokeLinecap="round"/>
        <path d="M0.8 -5 L1.5 -6.5" stroke="#101113" strokeWidth="0.5" strokeLinecap="round"/>
        <circle cx="-1.5" cy="-6.5" r="0.5" fill="#F7B500" stroke="#101113" strokeWidth="0.4"/>
        <circle cx="1.5" cy="-6.5" r="0.5" fill="#F7B500" stroke="#101113" strokeWidth="0.4"/>
        
        {/* Wings - vibrant with gradient effect */}
        <ellipse cx="-2.5" cy="-1" rx="2.8" ry="3.5" fill="#00D4B3" opacity="0.5" stroke="#00D4B3" strokeWidth="0.6"/>
        <ellipse cx="2.5" cy="-1" rx="2.8" ry="3.5" fill="#00D4B3" opacity="0.5" stroke="#00D4B3" strokeWidth="0.6"/>
        <ellipse cx="-2.3" cy="-0.5" rx="1.5" ry="2" fill="#FFFFFF" opacity="0.6"/>
        <ellipse cx="2.3" cy="-0.5" rx="1.5" ry="2" fill="#FFFFFF" opacity="0.6"/>
      </g>
      
      {/* Position robot bees around the hive - 8 positions */}
      <use href="#robotBee" transform="translate(60, 20)"/>
      <use href="#robotBee" transform="translate(88, 32)"/>
      <use href="#robotBee" transform="translate(98, 60)"/>
      <use href="#robotBee" transform="translate(88, 88)"/>
      <use href="#robotBee" transform="translate(60, 100)"/>
      <use href="#robotBee" transform="translate(32, 88)"/>
      <use href="#robotBee" transform="translate(22, 60)"/>
      <use href="#robotBee" transform="translate(32, 32)"/>
      
      {/* Motion trails - subtle mint teal lines */}
      <g stroke="#00D4B3" strokeWidth="1" opacity="0.2" strokeLinecap="round">
        <path d="M60 20 Q55 15 50 12"/>
        <path d="M88 32 Q92 28 96 24"/>
        <path d="M98 60 Q102 60 106 60"/>
        <path d="M88 88 Q92 92 96 96"/>
        <path d="M60 100 Q60 104 60 108"/>
        <path d="M32 88 Q28 92 24 96"/>
        <path d="M22 60 Q18 60 14 60"/>
        <path d="M32 32 Q28 28 24 24"/>
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
