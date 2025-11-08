import beehiveLogo from "@assets/beehive-icon-cropped.png";
import beehiveWordLogo from "@assets/beehive-wordlogo-cropped.png";

// BeehiveAI Icon Logo (honeycomb with bees and honey)
export function BeehiveIcon({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <img 
      src={beehiveLogo} 
      alt="BeehiveAI" 
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// BeehiveAI Word Logo (text with honey dripping effect)
export function BeehiveWordLogo({ size = "default", className = "" }: { size?: "sm" | "default" | "lg"; className?: string }) {
  const sizeMap = {
    sm: 120,
    default: 180,
    lg: 240
  };
  
  const height = sizeMap[size];
  
  return (
    <img 
      src={beehiveWordLogo} 
      alt="BeehiveAI" 
      className={`object-contain ${className}`}
      style={{ height: `${height}px`, width: 'auto' }}
    />
  );
}

// Combined logo (icon + text)
export function BeehiveLogo({ iconSize = 40, textSize = "default" }: { iconSize?: number; textSize?: "sm" | "default" | "lg" }) {
  return (
    <div className="flex items-center gap-3">
      <BeehiveIcon size={iconSize} />
      <span className="text-2xl font-bold text-white">BeehiveAI</span>
    </div>
  );
}
