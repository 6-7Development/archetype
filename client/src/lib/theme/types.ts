export interface ThemeColor {
  h: number;  // Hue (0-360)
  s: number;  // Saturation (0-100)
  l: number;  // Lightness (0-100)
}

export interface ThemePalette {
  // Brand colors
  primary: ThemeColor;        // Honey Gold
  secondary: ThemeColor;      // Mint Teal
  accent: ThemeColor;         // Additional accent
  
  // UI colors
  background: ThemeColor;     // Cream background
  foreground: ThemeColor;     // Charcoal text
  card: ThemeColor;          // Card background
  cardForeground: ThemeColor; // Card text
  
  // Status colors
  success: ThemeColor;        // Mint Teal
  warning: ThemeColor;        // Amber
  error: ThemeColor;          // Red
  info: ThemeColor;           // Blue
  
  // Muted colors
  muted: ThemeColor;
  mutedForeground: ThemeColor;
  
  // Border & Ring
  border: ThemeColor;
  ring: ThemeColor;
}

export interface ThemeConfig {
  name: string;
  palette: ThemePalette;
}

export const VIBRANT_LIGHT_THEME: ThemePalette = {
  // Brand - Honey Gold (#FDAD22 = hsl(40, 97%, 50%))
  primary: { h: 40, s: 97, l: 50 },
  
  // Secondary - Mint Teal (#00D9A3 = hsl(171, 100%, 42%))
  secondary: { h: 171, s: 100, l: 42 },
  
  // Accent - Nectar Gold (#FFD34D = hsl(48, 100%, 65%))
  accent: { h: 48, s: 100, l: 65 },
  
  // Backgrounds - Cream (#FFF8E6 = hsl(47, 100%, 95%))
  background: { h: 47, s: 100, l: 95 },
  foreground: { h: 216, s: 11, l: 12 }, // Graphite
  
  // Cards - Slightly elevated from background
  card: { h: 0, s: 0, l: 100 },         // White
  cardForeground: { h: 216, s: 11, l: 12 }, // Graphite
  
  // Status colors
  success: { h: 171, s: 100, l: 42 },   // Mint Teal
  warning: { h: 38, s: 92, l: 50 },     // Amber
  error: { h: 0, s: 84, l: 60 },        // Red
  info: { h: 217, s: 91, l: 60 },       // Blue
  
  // Muted - Subtle backgrounds and secondary text
  muted: { h: 47, s: 30, l: 88 },       // Muted cream
  mutedForeground: { h: 216, s: 9, l: 45 }, // Muted charcoal
  
  // Borders & Rings
  border: { h: 47, s: 20, l: 85 },      // Soft border
  ring: { h: 40, s: 97, l: 50 },        // Honey gold ring
};
