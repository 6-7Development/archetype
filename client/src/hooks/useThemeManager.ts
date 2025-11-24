import { useEffect, useCallback } from 'react';
import { ThemePalette, ThemeColor } from '@/lib/theme/types';

/**
 * Convert ThemeColor to HSL string for CSS
 */
function toHSL(color: ThemeColor): string {
  return `${color.h} ${color.s}% ${color.l}%`;
}

/**
 * Apply a theme palette to CSS variables
 */
export function applyThemePalette(palette: ThemePalette): void {
  const root = document.documentElement;
  
  // Brand colors
  root.style.setProperty('--primary', toHSL(palette.primary));
  root.style.setProperty('--primary-foreground', toHSL({ h: 0, s: 0, l: 100 })); // White text on primary
  
  root.style.setProperty('--secondary', toHSL(palette.secondary));
  root.style.setProperty('--secondary-foreground', toHSL({ h: 0, s: 0, l: 100 })); // White text on secondary
  
  root.style.setProperty('--accent', toHSL(palette.accent));
  root.style.setProperty('--accent-foreground', toHSL(palette.foreground));
  
  // Backgrounds
  root.style.setProperty('--background', toHSL(palette.background));
  root.style.setProperty('--foreground', toHSL(palette.foreground));
  
  // Cards
  root.style.setProperty('--card', toHSL(palette.card));
  root.style.setProperty('--card-foreground', toHSL(palette.cardForeground));
  
  // Status colors
  root.style.setProperty('--success', toHSL(palette.success));
  root.style.setProperty('--success-foreground', toHSL({ h: 0, s: 0, l: 100 }));
  
  root.style.setProperty('--warning', toHSL(palette.warning));
  root.style.setProperty('--warning-foreground', toHSL({ h: 0, s: 0, l: 100 }));
  
  root.style.setProperty('--destructive', toHSL(palette.error));
  root.style.setProperty('--destructive-foreground', toHSL({ h: 0, s: 0, l: 100 }));
  
  root.style.setProperty('--info', toHSL(palette.info));
  root.style.setProperty('--info-foreground', toHSL({ h: 0, s: 0, l: 100 }));
  
  // Muted
  root.style.setProperty('--muted', toHSL(palette.muted));
  root.style.setProperty('--muted-foreground', toHSL(palette.mutedForeground));
  
  // Borders & Rings
  root.style.setProperty('--border', toHSL(palette.border));
  root.style.setProperty('--input', toHSL(palette.border));
  root.style.setProperty('--ring', toHSL(palette.ring));
  
  // Popover (use card colors)
  root.style.setProperty('--popover', toHSL(palette.card));
  root.style.setProperty('--popover-foreground', toHSL(palette.cardForeground));
  
  console.log('[THEME] Applied palette to CSS variables');
}

/**
 * Hook to manage theme at runtime
 */
export function useThemeManager(palette: ThemePalette) {
  useEffect(() => {
    applyThemePalette(palette);
  }, [palette]);
  
  const updateColor = useCallback((variable: keyof ThemePalette, color: ThemeColor) => {
    const root = document.documentElement;
    root.style.setProperty(`--${variable}`, toHSL(color));
    console.log(`[THEME] Updated --${variable} to`, toHSL(color));
  }, []);
  
  return {
    updateColor,
    applyPalette: applyThemePalette,
  };
}
