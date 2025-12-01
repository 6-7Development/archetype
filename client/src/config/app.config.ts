/**
 * CENTRALIZED APP CONFIGURATION
 * =============================
 * All application-wide settings in one place.
 * Import from site-config.ts for site-specific content.
 * 
 * This file handles: API endpoints, features, limits, and runtime settings.
 * site-config.ts handles: Branding, content, layouts, theming.
 */

import { BRAND, THEME, AGENT, SEO } from './site-config';

export const APP_CONFIG = {
  // Re-export branding from site config for convenience
  branding: {
    name: BRAND.name,
    tagline: BRAND.tagline,
    description: BRAND.description,
    logo: BRAND.logo,
    social: BRAND.social,
    legal: BRAND.legal,
  },

  // Theme colors (from site config)
  theme: {
    primary: THEME.colors.honey.value,
    secondary: THEME.colors.mint.value,
    accent: THEME.colors.nectar.value,
    charcoal: THEME.colors.charcoal.value,
    cream: THEME.colors.cream.value,
    
    // Additional UI colors
    destructive: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    muted: '#6B7280',
  },

  // API Configuration
  api: {
    baseURL: import.meta.env.VITE_API_URL || '',
    timeout: 30000,
    retries: 3,
    
    endpoints: {
      // Chat & AI
      chat: '/api/chat',
      chatSession: '/api/chat/session',
      beehiveChat: '/api/beehive-ai/chat',
      beehiveStream: '/api/beehive-ai/stream',
      
      // Platform
      commands: '/api/commands',
      projects: '/api/projects',
      health: '/api/platform-health',
      incidents: '/api/incidents',
      jobs: '/api/beehive-ai/jobs',
      healing: '/api/healing',
      
      // Auth
      auth: {
        login: '/api/auth/login',
        logout: '/api/logout',
        register: '/api/auth/register',
        session: '/api/auth/session',
      },
      
      // User
      user: '/api/user',
      preferences: '/api/user/preferences',
    },
  },

  // Chat Configuration
  chat: {
    maxMessageLength: 10000,
    maxImages: 10,
    autoSaveInterval: 2000,
    messageBatchSize: 50,
    loadMoreThreshold: 5,
    
    placeholders: {
      input: `Message ${BRAND.name}...`,
      thinking: `${AGENT.name} is thinking...`,
      typing: 'Typing...',
      working: `${AGENT.name} is working...`,
    },
    
    emptyState: {
      title: AGENT.messages.idle,
      subtitle: 'Send a message to get started',
    },
  },

  // UI Component Settings
  ui: {
    // Animation settings
    animations: {
      enabled: true,
      reducedMotion: false,
      durations: {
        fast: 150,
        normal: 300,
        slow: 500,
      },
    },
    
    // Toast notifications
    toast: {
      duration: 3000,
      position: 'bottom-right',
    },
    
    // Modal settings
    modal: {
      closeOnOverlayClick: true,
      closeOnEscape: true,
    },
    
    // Spacing scale (rem values)
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      xxl: '3rem',
    },

    // Border radius scale
    borderRadius: {
      none: '0',
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      full: '9999px',
    },

    // Font sizes
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    
    // Font families
    fontFamily: {
      sans: 'Inter, system-ui, -apple-system, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
  },

  // Feature Flags
  features: {
    // Core features
    markdown: true,
    codeHighlighting: true,
    imageUpload: true,
    sessionPersistence: true,
    
    // Platform features
    platformHealing: true,
    incidentTracking: true,
    jobHistory: true,
    keyboardShortcuts: true,
    
    // AI features
    streamingResponses: true,
    thinkingIndicator: true,
    toolCallDisplay: true,
    
    // UI features
    darkMode: true,
    motionToggle: true,
    compactMode: false,
  },

  // Keyboard Shortcuts
  shortcuts: {
    send: ['Enter', 'Cmd+Enter'],
    newline: 'Shift+Enter',
    recallMessage: 'ArrowUp',
    clearInput: 'Cmd+U',
    focus: 'Cmd+K',
    toggleSidebar: 'Cmd+B',
    toggleTheme: 'Cmd+Shift+L',
  },

  // Limits & Quotas
  limits: {
    maxProjects: 100,
    maxTeamMembers: 50,
    maxStorageGB: 100,
    maxAPICallsPerMinute: 60,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxUploadFiles: 10,
  },

  // Default User Settings
  defaults: {
    theme: 'dark' as const,
    language: 'en',
    notifications: true,
    autoSave: true,
    compactMode: false,
    reducedMotion: false,
  },

  // Messages & Copy
  messages: {
    errors: {
      networkError: 'Network connection error. Please try again.',
      invalidInput: 'Invalid input. Please check and try again.',
      unauthorized: 'You are not authorized to perform this action.',
      serverError: 'Server error occurred. Please try again later.',
      rateLimited: 'Too many requests. Please slow down.',
      sessionExpired: 'Your session has expired. Please log in again.',
    },
    success: {
      saved: 'Changes saved successfully',
      deleted: 'Item deleted successfully',
      copied: 'Copied to clipboard',
      uploaded: 'Upload successful',
    },
    confirmations: {
      delete: 'Are you sure you want to delete this?',
      logout: 'Are you sure you want to log out?',
      discard: 'You have unsaved changes. Discard them?',
    },
    loading: {
      default: 'Loading...',
      saving: 'Saving...',
      processing: 'Processing...',
      uploading: 'Uploading...',
    },
  },

  // SEO (from site config)
  seo: SEO,

  // AI Agent Configuration (from site config)
  agent: AGENT,

  // Analytics & Telemetry
  telemetry: {
    enabled: import.meta.env.PROD,
    endpoint: '/api/telemetry',
    batchInterval: 5 * 60 * 1000, // 5 minutes
  },

  // Environment Detection
  environment: {
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
    apiUrl: import.meta.env.VITE_API_URL || '',
  },
} as const;

// Type for safe config access
export type AppConfig = typeof APP_CONFIG;

// Helper to safely get nested config values
export function getConfigValue<T = unknown>(path: string, defaultValue?: T): T {
  const keys = path.split('.');
  let value: unknown = APP_CONFIG;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return defaultValue as T;
    }
  }

  return value as T;
}

// Export individual sections for easier imports
export const { branding, theme, api, chat, ui, features, shortcuts, limits, defaults, messages, seo, agent, telemetry, environment } = APP_CONFIG;
