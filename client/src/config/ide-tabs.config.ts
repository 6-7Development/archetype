/**
 * Universal IDE Tabs Configuration
 * ================================
 * SINGLE SOURCE OF TRUTH for all IDE tabs with RBAC permissions
 * 
 * HOW TO EDIT:
 * 1. Add new tabs to IDE_TABS array
 * 2. Set requiredRole: 'user' | 'admin' | 'owner' (or undefined for all)
 * 3. Set requiredResource and requiredAction for fine-grained RBAC
 * 4. Tab will automatically appear/hide based on user permissions
 * 
 * RBAC RESOURCES: platform | projects | healing | admin | billing | team
 * RBAC ACTIONS: read | write | delete | execute | manage
 */

import type { Role, Resource, Action } from '@shared/rbac';
import type { LucideIcon } from 'lucide-react';
import {
  Eye,
  Terminal,
  FolderOpen,
  Database,
  GitBranch,
  Settings,
  FileJson,
  CheckSquare,
  Package,
  Search,
  AlertCircle,
  Wrench,
  Zap,
  Activity,
  Rocket,
  Shield,
  BarChart3,
} from 'lucide-react';

export type TabId = 
  | 'preview'
  | 'terminal'
  | 'files'
  | 'database'
  | 'git'
  | 'env'
  | 'logs'
  | 'tests'
  | 'packages'
  | 'search'
  | 'problems'
  | 'healing'
  | 'swarm'
  | 'incidents'
  | 'monitoring'
  | 'deployments'
  | 'analytics';

export interface IDETabConfig {
  id: TabId;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  description: string;
  
  requiredRole?: Role;
  requiredResource?: Resource;
  requiredAction?: Action;
  
  mobileHidden?: boolean;
  defaultOpen?: boolean;
  
  testId: string;
  
  category: 'core' | 'development' | 'admin' | 'operations';
}

/**
 * ALL IDE TABS - Ordered by category and importance
 * Edit this array to add/remove/reorder tabs
 */
export const IDE_TABS: IDETabConfig[] = [
  // ============================================
  // CORE TABS - Available to all authenticated users
  // Note: Chat is NOT a tab - it's in the left pane alongside these tabs
  // ============================================
  {
    id: 'preview',
    label: 'Preview',
    shortLabel: 'Preview',
    icon: Eye,
    description: 'Live preview of your application',
    category: 'core',
    defaultOpen: true,
    testId: 'tab-preview',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: Terminal,
    description: 'Command line interface',
    category: 'core',
    testId: 'tab-terminal',
  },

  // ============================================
  // DEVELOPMENT TABS - Project work
  // ============================================
  {
    id: 'files',
    label: 'Files',
    icon: FolderOpen,
    description: 'Browse and edit project files',
    category: 'development',
    requiredResource: 'projects',
    requiredAction: 'read',
    testId: 'tab-files',
  },
  {
    id: 'database',
    label: 'Database',
    shortLabel: 'DB',
    icon: Database,
    description: 'View and manage database',
    category: 'development',
    requiredResource: 'projects',
    requiredAction: 'read',
    testId: 'tab-database',
  },
  {
    id: 'git',
    label: 'Git',
    icon: GitBranch,
    description: 'Version control',
    category: 'development',
    requiredResource: 'projects',
    requiredAction: 'write',
    testId: 'tab-git',
  },
  {
    id: 'env',
    label: 'Environment',
    shortLabel: 'Env',
    icon: Settings,
    description: 'Environment variables',
    category: 'development',
    requiredResource: 'projects',
    requiredAction: 'read',
    testId: 'tab-env',
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: FileJson,
    description: 'Application logs',
    category: 'development',
    requiredResource: 'projects',
    requiredAction: 'read',
    testId: 'tab-logs',
  },
  {
    id: 'tests',
    label: 'Tests',
    icon: CheckSquare,
    description: 'Run and view tests',
    category: 'development',
    requiredResource: 'projects',
    requiredAction: 'read',
    testId: 'tab-tests',
  },
  {
    id: 'packages',
    label: 'Packages',
    icon: Package,
    description: 'Manage dependencies',
    category: 'development',
    requiredResource: 'projects',
    requiredAction: 'write',
    testId: 'tab-packages',
  },
  {
    id: 'search',
    label: 'Search',
    icon: Search,
    description: 'Search across codebase',
    category: 'development',
    requiredResource: 'projects',
    requiredAction: 'read',
    testId: 'tab-search',
  },
  {
    id: 'problems',
    label: 'Problems',
    icon: AlertCircle,
    description: 'View errors and warnings',
    category: 'development',
    requiredResource: 'projects',
    requiredAction: 'read',
    testId: 'tab-problems',
  },
  {
    id: 'deployments',
    label: 'Deployments',
    shortLabel: 'Deploy',
    icon: Rocket,
    description: 'Manage deployments',
    category: 'development',
    requiredResource: 'projects',
    requiredAction: 'write',
    testId: 'tab-deployments',
  },

  // ============================================
  // OPERATIONS TABS - Admin/Owner only
  // ============================================
  {
    id: 'swarm',
    label: 'SWARM Mode',
    shortLabel: 'SWARM',
    icon: Zap,
    description: 'Parallel multi-agent execution',
    category: 'operations',
    requiredRole: 'admin',
    requiredResource: 'platform',
    requiredAction: 'execute',
    testId: 'tab-swarm',
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    shortLabel: 'Monitor',
    icon: Activity,
    description: 'System health and performance',
    category: 'operations',
    requiredRole: 'admin',
    requiredResource: 'platform',
    requiredAction: 'read',
    testId: 'tab-monitoring',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    description: 'Usage and performance analytics',
    category: 'operations',
    requiredRole: 'admin',
    requiredResource: 'platform',
    requiredAction: 'read',
    testId: 'tab-analytics',
  },

  // ============================================
  // ADMIN TABS - Owner only (Platform Healing)
  // ============================================
  {
    id: 'healing',
    label: 'Platform Healing',
    shortLabel: 'Healing',
    icon: Wrench,
    description: 'Self-healing controls for platform',
    category: 'admin',
    requiredRole: 'owner',
    requiredResource: 'healing',
    requiredAction: 'execute',
    testId: 'tab-healing',
  },
  {
    id: 'incidents',
    label: 'Incidents',
    icon: Shield,
    description: 'View and manage platform incidents',
    category: 'admin',
    requiredRole: 'owner',
    requiredResource: 'healing',
    requiredAction: 'read',
    testId: 'tab-incidents',
  },
];

/**
 * Get tabs filtered by user role and permissions
 */
export function getAccessibleTabs(
  userRole: Role,
  hasPermission: (role: Role, resource: Resource, action: Action) => boolean
): IDETabConfig[] {
  return IDE_TABS.filter(tab => {
    if (tab.requiredRole) {
      const roleHierarchy: Role[] = ['user', 'admin', 'owner'];
      const userRoleIndex = roleHierarchy.indexOf(userRole);
      const requiredRoleIndex = roleHierarchy.indexOf(tab.requiredRole);
      if (userRoleIndex < requiredRoleIndex) {
        return false;
      }
    }
    
    if (tab.requiredResource && tab.requiredAction) {
      if (!hasPermission(userRole, tab.requiredResource, tab.requiredAction)) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Get tabs by category
 */
export function getTabsByCategory(tabs: IDETabConfig[]): Record<string, IDETabConfig[]> {
  return tabs.reduce((acc, tab) => {
    if (!acc[tab.category]) {
      acc[tab.category] = [];
    }
    acc[tab.category].push(tab);
    return acc;
  }, {} as Record<string, IDETabConfig[]>);
}

/**
 * Get default active tab
 */
export function getDefaultTab(tabs: IDETabConfig[]): TabId {
  const defaultTab = tabs.find(t => t.defaultOpen);
  return defaultTab?.id || tabs[0]?.id || 'preview';
}

/**
 * Tab categories with display info
 */
export const TAB_CATEGORIES = {
  core: { label: 'Core', order: 0 },
  development: { label: 'Development', order: 1 },
  operations: { label: 'Operations', order: 2 },
  admin: { label: 'Admin', order: 3 },
} as const;
