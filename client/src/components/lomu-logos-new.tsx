import iconLogoPath from "@assets/Gemini_Generated_Image_z9tsxzz9tsxzz9ts_1761874066745.png";
import wordLogoPath from "@assets/Gemini_Generated_Image_ixx4nbixx4nbixx4_1761874066746.png";

// Icon Logo - Lemon with "L" (cropped to remove border and background)
export function LomuIconLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <div 
      className={`relative overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: 'transparent',
      }}
    >
      <img
        src={iconLogoPath}
        alt="Lomu"
        className="absolute"
        style={{
          width: size * 1.4,
          height: size * 1.4,
          objectFit: 'contain',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%) scale(1.05)',
          // This removes background glow by focusing on the center lemon
        }}
      />
    </div>
  );
}

// Word Logo - "LOMU" text (cropped to remove glowing border and tagline)
export function LomuWordLogo({ height = 60, className = "" }: { height?: number; className?: string }) {
  return (
    <div 
      className={`relative ${className}`}
      style={{
        height: height,
        overflow: 'hidden',
      }}
    >
      <img
        src={wordLogoPath}
        alt="Lomu"
        style={{
          height: '100%', // Make image take full height of its container
          width: 'auto', // Allow width to adjust proportionally
          objectFit: 'contain',
          // Removed transform and filter as they were for cropping/glow compensation
        }}
      />
    </div>
  );
}

// Combined Logo - Icon + Text
export function LomuFullLogo({ 
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
      <LomuIconLogo size={iconSize} />
      <LomuWordLogo height={textHeight} />
    </div>
  );
}
