/**
 * Global Constants - Extracted from hard-coded values
 */

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  PROJECTS: '/projects',
  WORKSPACE: '/workspace',
  CHAT: '/chat',
  HEXAD_CHAT: '/lomu',
  INCIDENTS: '/incidents',
  PLATFORM_HEALING: '/platform-healing',
  SETTINGS: '/account',
  TEAM: '/team',
  BILLING: '/account',
  SUPPORT: '/support',
  ADMIN: '/admin',
  AUTH: '/auth',
  ERROR_403: '/error/403',
  ERROR_500: '/error/500',
  ANALYTICS: '/analytics',
  PUBLISHING: '/publishing',
  DEPLOYMENTS: '/deployments',
  API_KEYS: '/api-keys',
  MARKETPLACE: '/marketplace',
  BUILDER: '/builder',
  CONSULTATION_HISTORY: '/consultation-history',
  MONITORING: '/monitoring',
  DOCS: '/docs',
  PRIVACY: '/privacy',
  TERMS: '/terms',
  BLOG: '/blog',
  API_REFERENCE: '/api-reference',
} as const;

// Navigation items for AppLayout
export const NAVIGATION = {
  main: [
    { label: 'Dashboard', path: ROUTES.DASHBOARD, testId: 'nav-dashboard' },
    { label: 'Builder', path: ROUTES.BUILDER, testId: 'nav-builder' },
    { label: 'BeeHive Chat', path: ROUTES.HEXAD_CHAT, testId: 'nav-lomu-chat' },
    { label: 'Marketplace', path: ROUTES.MARKETPLACE, testId: 'nav-marketplace' },
  ],
  platform: [
    { label: 'Analytics', path: ROUTES.ANALYTICS, testId: 'nav-analytics' },
    { label: 'Publishing', path: ROUTES.PUBLISHING, testId: 'nav-publishing' },
    { label: 'Deployments', path: ROUTES.DEPLOYMENTS, testId: 'nav-deployments' },
    { label: 'Team', path: ROUTES.TEAM, testId: 'nav-team' },
  ],
  settings: [
    { label: 'System Monitoring', path: ROUTES.MONITORING, testId: 'nav-monitoring' },
    { label: 'Consultation History', path: ROUTES.CONSULTATION_HISTORY, testId: 'nav-consultation-history' },
    { label: 'API Keys', path: ROUTES.API_KEYS, testId: 'nav-api-keys' },
    { label: 'Support', path: ROUTES.SUPPORT, testId: 'nav-support' },
    { label: 'Account', path: ROUTES.SETTINGS, testId: 'nav-account' },
  ],
} as const;

export const API_ROUTES = {
  CHAT_MESSAGE: '/api/chat',
  CHAT_SESSION: '/api/chat/session',
  PLATFORM_HEALTH: '/api/platform-health',
  INCIDENTS: '/api/incidents',
  JOBS: '/api/beehive-ai/jobs',
  HEALING_START: '/api/healing/start',
  COMMANDS: '/api/commands',
  PROJECTS: '/api/projects',
  USER: '/api/user',
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/logout',
  LOGOUT: '/api/logout',
} as const;

export const UI_CONSTANTS = {
  // Avatar sizes
  AVATAR_SM: 'w-6 h-6',
  AVATAR_MD: 'w-8 h-8',
  AVATAR_LG: 'w-10 h-10',

  // Icon sizes
  ICON_SM: 'w-3 h-3',
  ICON_MD: 'w-4 h-4',
  ICON_LG: 'w-6 h-6',

  // Common spacing classes
  SPACING_XS: 'space-y-1',
  SPACING_SM: 'space-y-2',
  SPACING_MD: 'space-y-3',
  SPACING_LG: 'space-y-4',

  // Common padding
  PADDING_SM: 'px-2 py-1.5',
  PADDING_MD: 'px-3 py-2',
  PADDING_LG: 'px-4 py-3',

  // Common border radius
  ROUNDED_SM: 'rounded-md',
  ROUNDED_MD: 'rounded-lg',
  ROUNDED_LG: 'rounded-xl',
  ROUNDED_FULL: 'rounded-full',

  // Common transitions
  TRANSITION_FAST: 'transition-all duration-150',
  TRANSITION_NORMAL: 'transition-all duration-300',
  TRANSITION_SLOW: 'transition-all duration-500',
} as const;

export const MESSAGES = {
  LOADING: 'Loading...',
  SAVING: 'Saving...',
  ERROR: 'An error occurred',
  SUCCESS: 'Success!',
  EMPTY: 'No items found',
  PROCESSING: 'Processing...',
  READY: 'Ready to help',
  THINKING: 'Thinking...',
  WELCOME: 'Welcome to BeeHive',
} as const;

export const TIME_CONSTANTS = {
  DEBOUNCE_MS: 300,
  THROTTLE_MS: 1000,
  AUTO_SAVE_MS: 2000,
  TOAST_DURATION_MS: 3000,
  ANIMATION_DURATION_MS: 300,
  POLLING_INTERVAL_MS: 30000,
} as const;

export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MIN_PROJECT_NAME_LENGTH: 1,
  MAX_PROJECT_NAME_LENGTH: 100,
  MAX_MESSAGE_LENGTH: 10000,
  MAX_FILE_SIZE_MB: 100,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
} as const;

export const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  PENDING: 'pending',
} as const;

export const COLORS = {
  PRIMARY: '#FFD700',
  SECONDARY: '#00D4B3',
  ACCENT: '#F7B500',
  DESTRUCTIVE: '#EF4444',
  SUCCESS: '#10B981',
  WARNING: '#F59E0B',
  MUTED: '#6B7280',
  BACKGROUND: '#FFFFFF',
  FOREGROUND: '#000000',
} as const;

export const ARIA_LABELS = {
  OPEN_MENU: 'Open menu',
  CLOSE_MENU: 'Close menu',
  SEND_MESSAGE: 'Send message',
  COPY_MESSAGE: 'Copy message',
  DELETE: 'Delete',
  EDIT: 'Edit',
  LOADING: 'Loading',
  ERROR: 'Error',
  SUCCESS: 'Success',
} as const;
