/**
 * useWorkspaceConfig Hook
 * Easy way to configure WorkspaceLayout for any page
 * Just define what you want to show and the layout handles the rest!
 */

import { useMemo } from 'react';
import { useAuth } from './useAuth';

export interface WorkspaceConfig {
  projectId: string;
  projectName: string;
  mode: 'project' | 'platform-healing' | 'admin' | 'dashboard';
  tasks?: Array<{
    id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'completed';
    duration?: string;
    description?: string;
    subtasks?: number;
  }>;
  activityLog?: Array<{
    id: string;
    action: string;
    timestamp: Date;
    user: string;
  }>;
  showTabs?: ('editor' | 'preview' | 'console' | 'settings')[];
  customActions?: Array<{
    id: string;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'destructive';
  }>;
}

/**
 * Create workspace config for a page
 * Usage: const config = useWorkspaceConfig({ projectId, projectName, mode, tasks })
 */
export function useWorkspaceConfig(options: Partial<WorkspaceConfig>) {
  const { user } = useAuth();

  return useMemo(() => {
    const isOwner = user?.isOwner;
    const isAdmin = user?.role === 'admin';

    const config: WorkspaceConfig = {
      projectId: options.projectId || 'default',
      projectName: options.projectName || 'Workspace',
      mode: options.mode || 'dashboard',
      tasks: options.tasks || [],
      activityLog: options.activityLog || [],
      showTabs: options.showTabs || ['editor', 'preview', 'console'],
      customActions: options.customActions || [],
    };

    // Auto-add healing controls for platform owner
    if (isOwner && config.mode === 'platform-healing') {
      config.showTabs = [...(config.showTabs || []), 'settings'];
    }

    return config;
  }, [user, options]);
}

/**
 * Workspace presets - easy shortcuts for common layouts
 */
export const workspacePresets = {
  // User project editing
  project: (projectId: string, projectName: string, tasks?: any[]) => ({
    projectId,
    projectName,
    mode: 'project' as const,
    tasks: tasks || [],
    showTabs: ['editor', 'preview', 'console'] as const,
  }),

  // Admin viewing user projects
  adminProject: (projectId: string, projectName: string, tasks?: any[]) => ({
    projectId,
    projectName,
    mode: 'admin' as const,
    tasks: tasks || [],
    showTabs: ['editor', 'preview', 'console', 'settings'] as const,
  }),

  // Platform healing (owner only)
  platformHealing: (tasks?: any[]) => ({
    projectId: 'platform',
    projectName: 'Platform Healing',
    mode: 'platform-healing' as const,
    tasks: tasks || [],
    showTabs: ['editor', 'preview', 'console', 'settings'] as const,
  }),

  // Dashboard/overview
  dashboard: (projectName: string, tasks?: any[]) => ({
    projectId: 'dashboard',
    projectName,
    mode: 'dashboard' as const,
    tasks: tasks || [],
    showTabs: ['preview', 'console'] as const,
  }),

  // Team workspace
  team: (teamName: string, tasks?: any[]) => ({
    projectId: 'team',
    projectName: teamName,
    mode: 'admin' as const,
    tasks: tasks || [],
    showTabs: ['preview', 'console'] as const,
  }),
};
