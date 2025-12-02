/**
 * Seasonal Effects Context - Coordinates holiday decorations and effects
 * Features:
 * - Auto-detection of holiday seasons
 * - Centralized control for all seasonal effects
 * - User preference persistence
 * - Coordination between snow, decorations, and bee behavior
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type Season = 'christmas' | 'halloween' | 'spring' | 'summer' | 'none';

interface SeasonalSettings {
  snowEnabled: boolean;
  decorationsEnabled: boolean;
  snowIntensity: 'light' | 'medium' | 'heavy';
  maxSnowPiles: number;
}

interface SeasonalContextValue {
  currentSeason: Season;
  isHolidaySeason: boolean;
  settings: SeasonalSettings;
  updateSettings: (updates: Partial<SeasonalSettings>) => void;
  toggleSnow: () => void;
  toggleDecorations: () => void;
}

const defaultSettings: SeasonalSettings = {
  snowEnabled: true,
  decorationsEnabled: true,
  snowIntensity: 'medium',
  maxSnowPiles: 8,
};

const SeasonalContext = createContext<SeasonalContextValue | null>(null);

// Detect current season based on date
function detectSeason(): Season {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();

  // Christmas season: Dec 1 - Jan 6
  if (month === 11 || (month === 0 && day <= 6)) {
    return 'christmas';
  }
  
  // Halloween: Oct 15 - Nov 1
  if ((month === 9 && day >= 15) || (month === 10 && day <= 1)) {
    return 'halloween';
  }
  
  // Spring: Mar 20 - Jun 20
  if ((month === 2 && day >= 20) || month === 3 || month === 4 || (month === 5 && day <= 20)) {
    return 'spring';
  }
  
  // Summer: Jun 21 - Sep 22
  if ((month === 5 && day >= 21) || month === 6 || month === 7 || (month === 8 && day <= 22)) {
    return 'summer';
  }
  
  return 'none';
}

// Storage key for user preferences
const STORAGE_KEY = 'beehive-seasonal-settings';

export function SeasonalProvider({ children }: { children: React.ReactNode }) {
  const [currentSeason] = useState<Season>(() => detectSeason());
  const [settings, setSettings] = useState<SeasonalSettings>(() => {
    if (typeof window === 'undefined') return defaultSettings;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('[SEASONAL] Failed to load settings:', e);
    }
    return defaultSettings;
  });

  // Persist settings to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[SEASONAL] Failed to save settings:', e);
    }
  }, [settings]);

  const isHolidaySeason = useMemo(() => {
    return currentSeason === 'christmas' || currentSeason === 'halloween';
  }, [currentSeason]);

  const updateSettings = useCallback((updates: Partial<SeasonalSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleSnow = useCallback(() => {
    setSettings(prev => ({ ...prev, snowEnabled: !prev.snowEnabled }));
  }, []);

  const toggleDecorations = useCallback(() => {
    setSettings(prev => ({ ...prev, decorationsEnabled: !prev.decorationsEnabled }));
  }, []);

  const value = useMemo<SeasonalContextValue>(() => ({
    currentSeason,
    isHolidaySeason,
    settings,
    updateSettings,
    toggleSnow,
    toggleDecorations,
  }), [currentSeason, isHolidaySeason, settings, updateSettings, toggleSnow, toggleDecorations]);

  return (
    <SeasonalContext.Provider value={value}>
      {children}
    </SeasonalContext.Provider>
  );
}

export function useSeasonal() {
  const context = useContext(SeasonalContext);
  if (!context) {
    throw new Error('useSeasonal must be used within a SeasonalProvider');
  }
  return context;
}

// Hook to check if Christmas effects should be active
export function useChristmasEffects() {
  const { currentSeason, settings } = useSeasonal();
  
  return useMemo(() => ({
    isChristmas: currentSeason === 'christmas',
    snowEnabled: currentSeason === 'christmas' && settings.snowEnabled,
    decorationsEnabled: currentSeason === 'christmas' && settings.decorationsEnabled,
    snowIntensity: settings.snowIntensity,
    maxSnowPiles: settings.maxSnowPiles,
  }), [currentSeason, settings]);
}

export default SeasonalContext;
