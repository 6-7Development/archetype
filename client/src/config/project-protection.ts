/**
 * Project Protection Rules
 * Each project can define which files/settings are CRITICAL, SENSITIVE, or EDITABLE
 */

/**
 * Default protection rules for new projects
 */
export const DEFAULT_PROJECT_PROTECTION = {
  // These files are CRITICAL - should not be modified without extreme caution
  critical: [
    'package.json',
    'tsconfig.json',
    '.env',
    'src/index.ts',
    'src/main.tsx',
    'vite.config.ts',
    'drizzle.config.ts',
    'database schema',
  ],

  // These operations require approval
  sensitiveOperations: [
    'DELETE_FILE',
    'DELETE_FOLDER',
    'MODIFY_PACKAGE_JSON',
    'MODIFY_ENV',
    'MODIFY_CONFIG_FILE',
    'DATABASE_MIGRATION',
    'ENVIRONMENT_VAR_CHANGE',
    'DELETE_DATABASE_TABLE',
    'MODIFY_DATABASE_SCHEMA',
  ],

  // These can be freely modified
  editable: [
    'src/**/*.tsx',      // React components
    'src/**/*.ts',       // TypeScript files
    'src/styles/**/*',   // CSS/styling
    'src/assets/**/*',   // Images, etc
    'README.md',
    'docs/**/*',
  ],
};

/**
 * Check if a file is critical (cannot be modified)
 */
export function isCriticalFile(filePath: string, projectProtection?: any): boolean {
  const criticalFiles = projectProtection?.critical || DEFAULT_PROJECT_PROTECTION.critical;

  return criticalFiles.some((pattern: string) => {
    if (pattern.includes('*')) {
      // Wildcard pattern
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
      return regex.test(filePath);
    }
    return filePath === pattern;
  });
}

/**
 * Check if an operation requires approval
 */
export function operationRequiresApproval(
  operation: string,
  projectProtection?: any
): boolean {
  const sensitive = projectProtection?.sensitiveOperations || 
    DEFAULT_PROJECT_PROTECTION.sensitiveOperations;

  return sensitive.includes(operation);
}

/**
 * Check if a file can be freely edited
 */
export function isEditableFile(filePath: string, projectProtection?: any): boolean {
  const editable = projectProtection?.editable || DEFAULT_PROJECT_PROTECTION.editable;

  return editable.some((pattern: string) => {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return regex.test(filePath);
  });
}

/**
 * Get protection status of a file
 */
export function getFileProtectionStatus(
  filePath: string,
  projectProtection?: any
): 'critical' | 'sensitive' | 'editable' | 'protected' {
  if (isCriticalFile(filePath, projectProtection)) return 'critical';
  if (isEditableFile(filePath, projectProtection)) return 'editable';
  return 'protected'; // Default to protected if not explicitly editable
}

/**
 * Validate file change before applying
 */
export function validateFileChange(
  filePath: string,
  operation: 'create' | 'modify' | 'delete',
  projectProtection?: any
): { allowed: boolean; reason?: string; requiresApproval?: boolean } {
  const status = getFileProtectionStatus(filePath, projectProtection);

  if (status === 'critical') {
    return {
      allowed: false,
      reason: `${filePath} is a critical file and cannot be modified`,
    };
  }

  if (status === 'protected') {
    return {
      allowed: true,
      requiresApproval: true,
      reason: `${filePath} is protected and requires approval`,
    };
  }

  return { allowed: true }; // Editable files require no approval
}
