import iconLogoPath from "@assets/Gemini_Generated_Image_z9tsxzz9tsxzz9ts_1761874066745.png";
import wordLogoPath from "@assets/Gemini_Generated_Image_ixx4nbixx4nbixx4_1761874066746.png";

// Icon Logo - Lemon with "L" (cropped to remove border and background)
export function LomuIconLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <div 
      className={`relative ${className}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <img
        src={iconLogoPath}
        alt="Lomu"
        className="w-full h-full object-cover"
        style={{
          objectPosition: 'center',
          clipPath: 'circle(38% at 50% 50%)', // Crop to just the lemon icon
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
          height: height * 2.8, // Scale up to crop properly
          objectFit: 'contain',
          transform: 'translateY(-12%)', // Shift up to remove glowing border at top
          filter: 'brightness(1.1)', // Slightly brighten since we're removing glow
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
