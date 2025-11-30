// Simple SVG-based logos (no external image dependencies)

// Icon Logo - Lemon "L" symbol
export function BeeHiveIconLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-full bg-gradient-to-br from-[hsl(50,98%,58%)] to-[hsl(45,95%,52%)] ${className}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Lemon shape background */}
        <ellipse cx="50" cy="55" rx="35" ry="42" fill="hsl(50, 98%, 58%)" />
        
        {/* L letter in center */}
        <text
          x="50"
          y="70"
          fontSize="60"
          fontWeight="bold"
          fill="hsl(210, 14%, 24%)"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          L
        </text>
      </svg>
    </div>
  );
}

// Word Logo - "LOMU" text
export function BeeHiveWordLogo({ height = 60, className = "" }: { height?: number; className?: string }) {
  return (
    <div
      className={`relative flex items-center ${className}`}
      style={{ height }}
    >
      <svg
        height={height}
        viewBox="0 0 200 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: 'auto' }}
      >
        <text
          x="10"
          y="45"
          fontSize="48"
          fontWeight="bold"
          fill="currentColor"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-2"
        >
          LOMU
        </text>
      </svg>
    </div>
  );
}

// Combined Logo - Icon + Text
export function BeeHiveFullLogo({
  iconSize = 40,
  textHeight = 32,
  className = ""
}: {
  iconSize?: number;
  textHeight?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <BeeHiveIconLogo size={iconSize} />
      <BeeHiveWordLogo height={textHeight} />
    </div>
  );
}
