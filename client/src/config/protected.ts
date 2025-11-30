/**
 * Protected Configuration - Hard-coded critical values
 * These values are VITAL to platform integrity and cannot be changed without owner approval
 * 
 * Protection Levels:
 * - CRITICAL: Cannot be changed at runtime (database schema, auth logic, core APIs)
 * - SENSITIVE: Requires owner approval to change (environment variables, rate limits, security settings)
 * - EDITABLE: Can be changed freely (UI text, colors, branding, feature behavior)
 */

// ============================================================================
// CRITICAL - Core Platform Integrity (Hard-coded, no override possible)
// ============================================================================
export const CRITICAL_CONFIG = {
  // Database integrity - schema must match exactly
  database: {
    // Table structure is enforced by Drizzle ORM schema
    // Changes require database migration with approval
    requiresMigration: true,
    backupBeforeMigration: true,
  },

  // Authentication - core security logic cannot be disabled
  auth: {
    // Session validation is mandatory
    validateSessionRequired: true,
    // Password hashing is mandatory
    hashingRequired: true,
    // Authentication cannot be fully disabled (owner check still applies)
    cannotDisable: true,
  },

  // Core API routing - vital for platform function
  api: {
    // Core routes that cannot be moved or removed
    criticalRoutes: [
      '/api/auth',
      '/api/user',
      '/api/health',
      '/api/websocket',
      '/api/database',
    ],
    // These routes handle vital functionality
    protectedRoutes: true,
  },

  // WebSocket - real-time communication is vital
  websocket: {
    // WebSocket connection handling cannot be disabled
    connectionHandlingRequired: true,
    // Memory leak prevention is mandatory
    memoryProtectionRequired: true,
  },

  // Rate limiting core
  rateLimit: {
    // Core rate limiting logic cannot be disabled
    coreLogicRequired: true,
    // Token bucket algorithm is mandatory
    bucketAlgorithmRequired: true,
  },

  // Error handling
  errorHandling: {
    // Error boundaries are required
    boundariesRequired: true,
    // Errors must be logged
    loggingRequired: true,
  },
} as const;

// ============================================================================
// SENSITIVE - Requires Owner Approval to Change
// ============================================================================
export const SENSITIVE_CONFIG = {
  // Operations requiring owner confirmation
  requiresOwnerApproval: [
    'DELETE_USER',
    'DELETE_PROJECT',
    'DELETE_DEPLOYMENT',
    'DATABASE_MIGRATION',
    'ENVIRONMENT_VAR_CHANGE',
    'RATE_LIMIT_INCREASE',
    'DISABLE_FEATURE',
    'MODIFY_AUTH_STRATEGY',
    'PLATFORM_HEALING_TRIGGER',
    'DATA_EXPORT',
    'DATA_IMPORT',
    'CONFIGURATION_OVERRIDE',
  ] as const,

  // Operations that log audit trail
  auditLogged: [
    'CREATE_USER',
    'MODIFY_USER',
    'DELETE_USER',
    'CREATE_PROJECT',
    'MODIFY_PROJECT',
    'DELETE_PROJECT',
    'CONFIG_CHANGE',
    'ENV_VAR_CHANGE',
    'PERMISSION_GRANT',
    'PERMISSION_REVOKE',
  ] as const,

  // Access control levels
  accessLevels: {
    PUBLIC: 'public',           // No authentication needed
    AUTHENTICATED: 'authenticated', // Any logged-in user
    OWNER: 'owner',            // Platform owner only
    ADMIN: 'admin',            // Admin users only
  } as const,
} as const;

// ============================================================================
// EDITABLE - Can be changed by BeeHive or users (not critical)
// ============================================================================
export const EDITABLE_CONFIG = [
  // UI/UX (fully editable)
  'branding.name',
  'branding.logo',
  'branding.favicon',
  'branding.tagline',
  
  // Styling (fully editable)
  'theme.primary',
  'theme.secondary',
  'theme.accent',
  'theme.colors.*',
  
  // Text/Messages (fully editable)
  'messages.*',
  'chat.placeholders.*',
  
  // Feature flags (mostly editable, some require approval)
  'features.*',
  
  // UI constants (fully editable)
  'ui.spacing.*',
  'ui.fontSize.*',
  'ui.borderRadius.*',
  
  // Shortcuts (fully editable)
  'shortcuts.*',
  
  // Social links (fully editable)
  'social.*',
  
  // Chat behavior (fully editable within limits)
  'chat.maxMessageLength', // Up to 100,000
  'chat.maxImages',        // Up to 100
  'chat.autoSaveInterval', // 1000+ ms
  'chat.messageBatchSize', // 1-1000
  
  // Telemetry (mostly editable)
  'telemetry.enabled',
  'telemetry.endpoint',
  
  // API endpoints (editable but careful)
  'api.endpoints.*',  // Can point to different services
  'api.baseURL',      // Can point to different server
] as const;

// ============================================================================
// Approval System for Destructive Operations
// ============================================================================
export const APPROVAL_SYSTEM = {
  // Operations that require owner email confirmation
  emailConfirmationRequired: [
    'DELETE_USER',
    'DELETE_PROJECT',
    'DELETE_DEPLOYMENT',
    'DATABASE_MIGRATION',
    'ENVIRONMENT_VAR_CHANGE',
    'PLATFORM_HEALING_TRIGGER',
  ],

  // Operations that trigger audit logs
  auditTrail: {
    captureUser: true,
    captureTimestamp: true,
    captureReason: true,
    captureChangeBefore: true,
    captureChangeAfter: true,
    retentionDays: 365,
  },

  // Rollback capability
  rollback: {
    enabledFor: [
      'CONFIG_CHANGE',
      'DATABASE_MIGRATION',
      'DATA_IMPORT',
      'ENV_VAR_CHANGE',
    ],
    snapshotBefore: true,
    maxRollbackDays: 30,
  },
} as const;

// ============================================================================
// Access Control Matrix
// ============================================================================
export const ACCESS_CONTROL = {
  // Who can do what
  permissions: {
    // Public access
    public: {
      read: ['landing', 'pricing', 'docs'],
      write: [],
      delete: [],
    },

    // Authenticated user access
    authenticated: {
      read: ['dashboard', 'projects', 'chat'],
      write: ['projects', 'chat', 'account'],
      delete: ['own_projects', 'own_chat_history'],
    },

    // Admin access
    admin: {
      read: ['*'],
      write: ['users', 'projects', 'deployments'],
      delete: ['projects', 'deployments'],
    },

    // Owner access (platform owner only)
    owner: {
      read: ['*'],
      write: ['*'],
      delete: ['*'],
      sensitiveOps: true,
      canModifyAdmin: true,
      canPlatformHeal: true,
      canViewAuditLog: true,
    },
  },

  // Role hierarchy
  roleHierarchy: {
    owner: 999,
    admin: 100,
    authenticated: 1,
    public: 0,
  },
} as const;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if a config path is protected (cannot be changed without approval)
 */
export function isProtectedConfig(path: string): boolean {
  // Critical configs are always protected
  if (path.startsWith('database.') || 
      path.startsWith('auth.') || 
      path.startsWith('api.criticalRoutes')) {
    return true;
  }

  // Check if in sensitive list
  return SENSITIVE_CONFIG.requiresOwnerApproval.some(op => 
    path.toLowerCase().includes(op.toLowerCase())
  );
}

/**
 * Check if an operation requires owner approval
 */
export function requiresOwnerApproval(operation: string): boolean {
  return SENSITIVE_CONFIG.requiresOwnerApproval.includes(
    operation.toUpperCase() as any
  );
}

/**
 * Check if a config path is editable
 */
export function isEditableConfig(path: string): boolean {
  return EDITABLE_CONFIG.some(editablePath => {
    const pattern = editablePath.replace('*', '.*');
    return new RegExp(`^${pattern}$`).test(path);
  });
}

/**
 * Check user access level for operation
 */
export function checkAccess(
  userRole: string, 
  operation: 'read' | 'write' | 'delete',
  resource: string
): boolean {
  const permissions = ACCESS_CONTROL.permissions[userRole as keyof typeof ACCESS_CONTROL.permissions];
  if (!permissions) return false;

  const allowedResources = permissions[operation] || [];
  return allowedResources.includes('*') || allowedResources.includes(resource);
}

/**
 * Validate config value before setting
 */
export function validateConfigValue(
  path: string,
  value: any
): { valid: boolean; reason?: string } {
  // Check if protected
  if (isProtectedConfig(path)) {
    return { valid: false, reason: 'This configuration is protected and requires approval' };
  }

  // Check if editable
  if (!isEditableConfig(path)) {
    return { valid: false, reason: 'This configuration cannot be modified' };
  }

  // Specific validations
  if (path === 'chat.maxMessageLength') {
    if (typeof value !== 'number' || value < 100 || value > 100000) {
      return { valid: false, reason: 'Message length must be 100-100,000' };
    }
  }

  if (path === 'chat.maxImages') {
    if (typeof value !== 'number' || value < 1 || value > 100) {
      return { valid: false, reason: 'Max images must be 1-100' };
    }
  }

  if (path === 'chat.autoSaveInterval') {
    if (typeof value !== 'number' || value < 1000) {
      return { valid: false, reason: 'Auto-save interval must be 1000ms or higher' };
    }
  }

  return { valid: true };
}
