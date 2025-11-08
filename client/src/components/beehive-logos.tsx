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
      
      {/* Robot Bee Component - reusable */}
      <g id="robotBee">
        {/* Bee body - metallic gray */}
        <ellipse cx="0" cy="0" rx="4" ry="5" fill="#606060" stroke="#101113" strokeWidth="0.8"/>
        
        {/* Golden stripes */}
        <ellipse cx="0" cy="-1.5" rx="3.5" ry="1" fill="#F7B500"/>
        <ellipse cx="0" cy="1.5" rx="3.5" ry="1" fill="#FFD34D"/>
        
        {/* Glowing mint eyes */}
        <circle cx="-1.2" cy="-1" r="1" fill="#00D4B3" opacity="0.9">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="1.2" cy="-1" r="1" fill="#00D4B3" opacity="0.9">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite"/>
        </circle>
        
        {/* Tech wings - simplified */}
        <ellipse cx="-3" cy="-2" rx="3" ry="4" fill="#00D4B3" opacity="0.3" stroke="#00D4B3" strokeWidth="0.5"/>
        <ellipse cx="3" cy="-2" rx="3" ry="4" fill="#00D4B3" opacity="0.3" stroke="#00D4B3" strokeWidth="0.5"/>
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
        
        {/* Robot bee mini */}
        <g id="miniBee">
          <ellipse cx="0" cy="0" rx="2" ry="2.5" fill="#606060" stroke="#101113" strokeWidth="0.5"/>
          <ellipse cx="0" cy="-0.7" rx="1.8" ry="0.5" fill="#F7B500"/>
          <ellipse cx="0" cy="0.7" rx="1.8" ry="0.5" fill="#FFD34D"/>
          <circle cx="-0.6" cy="-0.5" r="0.5" fill="#00D4B3" opacity="0.9"/>
          <circle cx="0.6" cy="-0.5" r="0.5" fill="#00D4B3" opacity="0.9"/>
          <ellipse cx="-1.5" cy="-1" rx="1.5" ry="2" fill="#00D4B3" opacity="0.3" stroke="#00D4B3" strokeWidth="0.3"/>
          <ellipse cx="1.5" cy="-1" rx="1.5" ry="2" fill="#00D4B3" opacity="0.3" stroke="#00D4B3" strokeWidth="0.3"/>
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
      {/* Icon - small version with robot bees */}
      <g transform="translate(5, 5)">
        {/* Border circles */}
        <circle cx="20" cy="20" r="19" stroke="#101113" strokeWidth="1.5" fill="none"/>
        <circle cx="20" cy="20" r="17.5" stroke="#00D4B3" strokeWidth="1" fill="none" opacity="0.6"/>
        
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
        
        {/* Tiny robot bee */}
        <g id="tinyBee">
          <ellipse cx="0" cy="0" rx="1.5" ry="1.8" fill="#606060" stroke="#101113" strokeWidth="0.4"/>
          <ellipse cx="0" cy="-0.5" rx="1.2" ry="0.4" fill="#F7B500"/>
          <ellipse cx="0" cy="0.5" rx="1.2" ry="0.4" fill="#FFD34D"/>
          <circle cx="-0.4" cy="-0.4" r="0.3" fill="#00D4B3" opacity="0.9"/>
          <circle cx="0.4" cy="-0.4" r="0.3" fill="#00D4B3" opacity="0.9"/>
          <ellipse cx="-1" cy="-0.7" rx="1" ry="1.5" fill="#00D4B3" opacity="0.3" stroke="#00D4B3" strokeWidth="0.2"/>
          <ellipse cx="1" cy="-0.7" rx="1" ry="1.5" fill="#00D4B3" opacity="0.3" stroke="#00D4B3" strokeWidth="0.2"/>
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
