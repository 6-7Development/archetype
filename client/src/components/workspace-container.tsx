/**
 * WorkspaceContainer - Wrapper for pages using WorkspaceLayout
 * Makes it super easy to add the workspace layout to any page
 */

import { ReactNode } from 'react';
import { WorkspaceLayout } from './workspace-layout';
import { useAuth } from '@/hooks/useAuth';
import { WorkspaceConfig } from '@/hooks/useWorkspaceConfig';

interface WorkspaceContainerProps extends WorkspaceConfig {
  children?: ReactNode;
  onTaskSelect?: (taskId: string) => void;
  onEditorChange?: (content: string) => void;
  rightPanelContent?: ReactNode;
  customTabs?: Array<{
    id: string;
    label: string;
    icon?: ReactNode;
    content: ReactNode;
  }>;
}

/**
 * Wrapper component for WorkspaceLayout with RBAC pre-configured
 * Just pass config and children, it handles the rest!
 */
export function WorkspaceContainer({
  projectId,
  projectName,
  mode,
  tasks = [],
  activityLog = [],
  children,
  onTaskSelect,
  onEditorChange,
  rightPanelContent,
  customTabs,
}: WorkspaceContainerProps) {
  const { user } = useAuth();

  // Auto-detect role
  const isOwner = user?.isOwner;
  const isAdmin = user?.role === 'admin';
  let userRole: 'owner' | 'member' | 'admin' | 'super_admin' = 'member';
  if (isOwner) userRole = 'super_admin';
  else if (isAdmin) userRole = 'admin';
  else if (mode === 'project') userRole = 'owner';

  return (
    <WorkspaceLayout
      projectId={projectId}
      projectName={projectName}
      mode={mode}
      isAdmin={isOwner}
      userRole={userRole}
      tasks={tasks}
      activityLog={activityLog}
      onTaskSelect={onTaskSelect}
      onEditorChange={onEditorChange}
    >
      {rightPanelContent || children}
    </WorkspaceLayout>
  );
}
