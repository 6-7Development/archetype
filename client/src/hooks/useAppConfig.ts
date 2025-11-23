import { useMemo } from 'react';
import { APP_CONFIG, getConfigValue } from '@/config/app.config';

/**
 * Hook to safely access app configuration
 * Provides type-safe config access throughout the app
 */
export function useAppConfig() {
  return useMemo(() => ({
    // Direct access
    config: APP_CONFIG,

    // Utility functions
    getValue: getConfigValue,

    // Commonly used getters
    getApiUrl: (endpoint: string) => {
      const base = APP_CONFIG.api.baseURL;
      return endpoint.startsWith('/') ? `${base}${endpoint}` : `${base}/${endpoint}`;
    },

    getThemeColor: (colorName: keyof typeof APP_CONFIG.theme) => {
      return APP_CONFIG.theme[colorName];
    },

    isFeatureEnabled: (feature: keyof typeof APP_CONFIG.features) => {
      return APP_CONFIG.features[feature];
    },

    getBrandName: () => APP_CONFIG.branding.name,

    getSocialLink: (platform: keyof typeof APP_CONFIG.social) => {
      return APP_CONFIG.social[platform];
    },
  }), []);
}
