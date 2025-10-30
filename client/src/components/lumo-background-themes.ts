// Background themes for Lumo avatar
// Can be used for holidays, special events, advertisements, etc.

export type BackgroundTheme = 
  | "default" 
  | "halloween" 
  | "christmas" 
  | "newyear" 
  | "valentines"
  | "celebration"
  | "dark"
  | "light"
  | "rainbow"
  | "cyberpunk";

interface ThemeConfig {
  gradients: string[];
  particleColor: string;
  particleCount: number;
  animationSpeed: number;
  borderGlow: string;
}

export const backgroundThemes: Record<BackgroundTheme, ThemeConfig> = {
  default: {
    gradients: [
      "linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 50%, rgba(168, 85, 247, 0.2) 100%)",
      "linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(6, 182, 212, 0.2) 50%, rgba(59, 130, 246, 0.2) 100%)",
      "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(168, 85, 247, 0.2) 50%, rgba(6, 182, 212, 0.2) 100%)",
    ],
    particleColor: "#06b6d4",
    particleCount: 20,
    animationSpeed: 10,
    borderGlow: "linear-gradient(135deg, #06b6d4, #3b82f6, #a855f7, #06b6d4)",
  },
  
  halloween: {
    gradients: [
      "linear-gradient(135deg, rgba(251, 146, 60, 0.2) 0%, rgba(168, 85, 247, 0.2) 50%, rgba(0, 0, 0, 0.3) 100%)",
      "linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(251, 146, 60, 0.2) 50%, rgba(0, 0, 0, 0.3) 100%)",
    ],
    particleColor: "#fb923c",
    particleCount: 30,
    animationSpeed: 8,
    borderGlow: "linear-gradient(135deg, #fb923c, #a855f7, #000000, #fb923c)",
  },
  
  christmas: {
    gradients: [
      "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(34, 197, 94, 0.2) 50%, rgba(255, 255, 255, 0.2) 100%)",
      "linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(239, 68, 68, 0.2) 50%, rgba(255, 255, 255, 0.2) 100%)",
    ],
    particleColor: "#fbbf24",
    particleCount: 40,
    animationSpeed: 12,
    borderGlow: "linear-gradient(135deg, #ef4444, #22c55e, #ffffff, #ef4444)",
  },
  
  newyear: {
    gradients: [
      "linear-gradient(135deg, rgba(251, 191, 36, 0.3) 0%, rgba(168, 85, 247, 0.3) 50%, rgba(6, 182, 212, 0.3) 100%)",
      "linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(251, 191, 36, 0.3) 50%, rgba(168, 85, 247, 0.3) 100%)",
    ],
    particleColor: "#fbbf24",
    particleCount: 50,
    animationSpeed: 6,
    borderGlow: "linear-gradient(135deg, #fbbf24, #a855f7, #06b6d4, #fbbf24)",
  },
  
  valentines: {
    gradients: [
      "linear-gradient(135deg, rgba(244, 63, 94, 0.2) 0%, rgba(236, 72, 153, 0.2) 50%, rgba(219, 39, 119, 0.2) 100%)",
      "linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(244, 63, 94, 0.2) 50%, rgba(219, 39, 119, 0.2) 100%)",
    ],
    particleColor: "#f43f5e",
    particleCount: 35,
    animationSpeed: 9,
    borderGlow: "linear-gradient(135deg, #f43f5e, #ec4899, #db2777, #f43f5e)",
  },
  
  celebration: {
    gradients: [
      "linear-gradient(135deg, rgba(251, 191, 36, 0.3) 0%, rgba(34, 197, 94, 0.3) 50%, rgba(59, 130, 246, 0.3) 100%)",
      "linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(251, 191, 36, 0.3) 50%, rgba(34, 197, 94, 0.3) 100%)",
    ],
    particleColor: "#fbbf24",
    particleCount: 45,
    animationSpeed: 7,
    borderGlow: "linear-gradient(135deg, #fbbf24, #22c55e, #3b82f6, #fbbf24)",
  },
  
  dark: {
    gradients: [
      "linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(30, 30, 30, 0.4) 50%, rgba(10, 10, 10, 0.4) 100%)",
      "linear-gradient(135deg, rgba(30, 30, 30, 0.4) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(10, 10, 10, 0.4) 100%)",
    ],
    particleColor: "#6b7280",
    particleCount: 15,
    animationSpeed: 11,
    borderGlow: "linear-gradient(135deg, #374151, #1f2937, #111827, #374151)",
  },
  
  light: {
    gradients: [
      "linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(240, 240, 240, 0.3) 50%, rgba(250, 250, 250, 0.3) 100%)",
      "linear-gradient(135deg, rgba(250, 250, 250, 0.3) 0%, rgba(255, 255, 255, 0.3) 50%, rgba(240, 240, 240, 0.3) 100%)",
    ],
    particleColor: "#d1d5db",
    particleCount: 15,
    animationSpeed: 11,
    borderGlow: "linear-gradient(135deg, #f3f4f6, #e5e7eb, #d1d5db, #f3f4f6)",
  },
  
  rainbow: {
    gradients: [
      "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(251, 191, 36, 0.2) 20%, rgba(34, 197, 94, 0.2) 40%, rgba(6, 182, 212, 0.2) 60%, rgba(59, 130, 246, 0.2) 80%, rgba(168, 85, 247, 0.2) 100%)",
      "linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(59, 130, 246, 0.2) 20%, rgba(6, 182, 212, 0.2) 40%, rgba(34, 197, 94, 0.2) 60%, rgba(251, 191, 36, 0.2) 80%, rgba(239, 68, 68, 0.2) 100%)",
    ],
    particleColor: "#a855f7",
    particleCount: 40,
    animationSpeed: 8,
    borderGlow: "linear-gradient(135deg, #ef4444, #fbbf24, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444)",
  },
  
  cyberpunk: {
    gradients: [
      "linear-gradient(135deg, rgba(236, 72, 153, 0.3) 0%, rgba(6, 182, 212, 0.3) 50%, rgba(168, 85, 247, 0.3) 100%)",
      "linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(168, 85, 247, 0.3) 50%, rgba(236, 72, 153, 0.3) 100%)",
    ],
    particleColor: "#ec4899",
    particleCount: 35,
    animationSpeed: 6,
    borderGlow: "linear-gradient(135deg, #ec4899, #06b6d4, #a855f7, #ec4899)",
  },
};

// Helper to get theme for current date (auto-detection)
export function getAutoTheme(): BackgroundTheme {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  
  // Halloween (October 25-31)
  if (month === 10 && day >= 25) {
    return "halloween";
  }
  
  // Christmas (December 20-25)
  if (month === 12 && day >= 20 && day <= 25) {
    return "christmas";
  }
  
  // New Year (December 26 - January 5)
  if ((month === 12 && day >= 26) || (month === 1 && day <= 5)) {
    return "newyear";
  }
  
  // Valentine's Day (February 13-14)
  if (month === 2 && day >= 13 && day <= 14) {
    return "valentines";
  }
  
  return "default";
}
