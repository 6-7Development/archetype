/**
 * Centralized App Configuration
 * All customizable values in one place - no hard-coding
 */

export const APP_CONFIG = {
  // Branding
  branding: {
    name: 'BeeHive',
    tagline: 'Collaborative Hive Intelligence for Code',
    logo: '/logo.png', // Configurable path
    favicon: '/favicon.ico',
  },

  // Colors & Theme
  theme: {
    primary: '#FFD700', // Gold/primary color
    secondary: '#00D4B3', // Mint/teal
    accent: '#F7B500', // Honey
    destructive: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    muted: '#6B7280',
  },

  // API Endpoints
  api: {
    baseURL: import.meta.env.VITE_API_URL || '', // Use relative paths for same-origin requests
    endpoints: {
      chat: '/api/chat',
      commands: '/api/commands',
      projects: '/api/projects',
      health: '/api/platform-health',
      incidents: '/api/incidents',
      jobs: '/api/beehive-ai/jobs',
      healing: '/api/healing',
      auth: {
        login: '/api/auth/login',
        logout: '/api/logout',
        register: '/api/auth/register',
      },
    },
  },

  // Chat Configuration
  chat: {
    maxMessageLength: 10000,
    maxImages: 10,
    autoSaveInterval: 2000, // ms
    messageBatchSize: 50,
    loadMoreThreshold: 5,
    emptyStateText: 'Ready to help',
    emptyStateSubtext: 'Send a message to get started',
    placeholders: {
      input: 'Message BeeHive...',
      thinking: 'Processing...',
      typing: 'Typing...',
    },
  },

  // UI Components
  ui: {
    // Button sizes and styles
    buttons: {
      primary: 'bg-primary text-primary-foreground',
      secondary: 'bg-secondary text-secondary-foreground',
      outline: 'border border-primary text-primary',
      ghost: 'text-foreground hover:bg-muted',
      destructive: 'bg-destructive text-destructive-foreground',
    },

    // Spacing constants
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      xxl: '3rem',
    },

    // Border radius
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
    },
  },

  // Feature Flags
  features: {
    markdown: true,
    codeHighlighting: true,
    imageUpload: true,
    sessionPersistence: true,
    platformHealing: true,
    incidentTracking: true,
    jobHistory: true,
    keyboardShortcuts: true,
  },

  // Keyboard Shortcuts
  shortcuts: {
    send: ['Enter', 'Cmd+Enter'],
    newline: 'Shift+Enter',
    recallMessage: 'ArrowUp',
    clearInput: 'Cmd+U',
    focus: 'Cmd+K',
  },

  // Limits & Quotas
  limits: {
    maxProjects: 100,
    maxTeamMembers: 50,
    maxStorageGB: 100,
    maxAPICallsPerMinute: 60,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
  },

  // Default User Settings
  defaults: {
    theme: 'light' as const,
    language: 'en',
    notifications: true,
    autoSave: true,
    compactMode: false,
  },

  // Messages & Copy
  messages: {
    errors: {
      networkError: 'Network connection error. Please try again.',
      invalidInput: 'Invalid input. Please check and try again.',
      unauthorized: 'You are not authorized to perform this action.',
      serverError: 'Server error occurred. Please try again later.',
    },
    success: {
      saved: 'Changes saved successfully',
      deleted: 'Item deleted successfully',
      copied: 'Copied to clipboard',
    },
    confirmations: {
      delete: 'Are you sure you want to delete this?',
      logout: 'Are you sure you want to log out?',
    },
  },

  // Analytics & Telemetry
  telemetry: {
    enabled: true,
    endpoint: '/api/telemetry',
    batchInterval: 5 * 60 * 1000, // 5 minutes
  },

  // Social & External Links
  social: {
    github: 'https://github.com/6-7Development/archetype',
    twitter: 'https://twitter.com/beehiveai',
    docs: 'https://docs.beehive.ai',
    support: 'https://support.beehive.ai',
  },

  // Environment Detection
  environment: {
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
    apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  },
} as const;

// Type for safe config access
export type AppConfig = typeof APP_CONFIG;

// Helper to safely get nested config values
export function getConfigValue<T = any>(path: string, defaultValue?: T): T {
  const keys = path.split('.');
  let value: any = APP_CONFIG;

  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) return defaultValue as T;
  }

  return value as T;
}
