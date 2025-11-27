/**
 * Universal RBAC Configuration
 * Single source of truth for all permissions
 * Dynamic - changes apply immediately without code changes
 */

export type Role = 'user' | 'admin' | 'owner';
export type TeamRole = 'admin' | 'member' | 'viewer';
export type Resource = 'platform' | 'projects' | 'healing' | 'admin' | 'billing' | 'team';
export type Action = 'read' | 'write' | 'delete' | 'execute' | 'manage';
export type AutonomyLevel = 'basic' | 'standard' | 'deep' | 'max';

/**
 * Universal RBAC Matrix
 * Defines what each role can do on each resource
 */
const RBAC_MATRIX: Record<Role, Record<Resource, Action[]>> = {
  user: {
    platform: ['read'],
    projects: ['read', 'write'],
    healing: [],
    admin: [],
    billing: ['read'],
    team: ['read'],
  },
  admin: {
    platform: ['read', 'write'],
    projects: ['read', 'write', 'delete'],
    healing: ['read', 'write'],
    admin: ['read', 'write'],
    billing: ['read', 'write'],
    team: ['read', 'write', 'manage'],
  },
  owner: {
    platform: ['read', 'write', 'execute', 'manage'],
    projects: ['read', 'write', 'delete'],
    healing: ['read', 'write', 'execute', 'manage'],
    admin: ['read', 'write', 'manage'],
    billing: ['read', 'write', 'manage'],
    team: ['read', 'write', 'delete', 'manage'],
  },
};

/**
 * Check if a role has permission on a resource
 */
export function hasPermission(role: Role, resource: Resource, action: Action): boolean {
  const permissions = RBAC_MATRIX[role] || RBAC_MATRIX.user;
  const allowedActions = permissions[resource] || [];
  return allowedActions.includes(action);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Array<{ resource: Resource; action: Action }> {
  const permissions: Array<{ resource: Resource; action: Action }> = [];
  const matrix = RBAC_MATRIX[role] || RBAC_MATRIX.user;
  
  for (const [resource, actions] of Object.entries(matrix)) {
    for (const action of actions as Action[]) {
      permissions.push({ resource: resource as Resource, action });
    }
  }
  
  return permissions;
}

/**
 * Get all resources a role can access
 */
export function getAccessibleResources(role: Role): Resource[] {
  const matrix = RBAC_MATRIX[role] || RBAC_MATRIX.user;
  return Object.keys(matrix).filter(
    (resource) => (matrix[resource as Resource] || []).length > 0
  ) as Resource[];
}

/**
 * Get accessible autonomy levels based on role
 */
export function getAccessibleAutonomyLevels(role: Role): AutonomyLevel[] {
  const levels: Record<Role, AutonomyLevel[]> = {
    user: ['basic', 'standard'],
    admin: ['basic', 'standard', 'deep'],
    owner: ['basic', 'standard', 'deep', 'max'],
  };
  return levels[role] || levels.user;
}

/**
 * Middleware helper: Check if route is accessible
 */
export function isRouteAccessible(role: Role, resource: Resource, action: Action): boolean {
  return hasPermission(role, resource, action);
}

/**
 * ENTERPRISE: Team-level permissions
 * Team admin can manage members, billing, and SSO
 */
export function hasTeamPermission(
  teamRole: TeamRole,
  resource: 'team' | 'billing' | 'members' | 'sso',
  action: Action
): boolean {
  const TEAM_RBAC_MATRIX: Record<TeamRole, Record<string, Action[]>> = {
    admin: {
      team: ['read', 'write', 'manage'],
      billing: ['read', 'write', 'manage'],
      members: ['read', 'write', 'delete', 'manage'],
      sso: ['read', 'write', 'manage'],
    },
    member: {
      team: ['read'],
      billing: ['read'],
      members: ['read'],
      sso: ['read'],
    },
    viewer: {
      team: ['read'],
      billing: ['read'],
      members: ['read'],
      sso: [],
    },
  };

  const permissions = TEAM_RBAC_MATRIX[teamRole] || TEAM_RBAC_MATRIX.viewer;
  const allowedActions = permissions[resource] || [];
  return allowedActions.includes(action);
}
