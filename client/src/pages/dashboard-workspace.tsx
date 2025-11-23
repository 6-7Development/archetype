/**
 * Dashboard with Workspace Layout
 * Shows project overview with the IDE-style layout
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { WorkspaceContainer } from '@/components/workspace-container';
import { workspacePresets } from '@/hooks/useWorkspaceConfig';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardWorkspace() {
  const { user } = useAuth();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Fetch user's projects and recent activity
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['/api/dashboard'],
    enabled: !!user,
  });

  if (isLoading) return <Skeleton className="w-full h-screen" />;

  // Convert dashboard data to workspace format
  const tasks = (dashboard?.recentActivities || []).map((activity: any, idx: number) => ({
    id: `task_${idx}`,
    title: activity.action,
    status: activity.status || 'in_progress',
    description: activity.description,
    duration: activity.duration,
  }));

  const config = workspacePresets.dashboard('My Dashboard', tasks);

  return (
    <WorkspaceContainer
      {...config}
      onTaskSelect={setSelectedTaskId}
      rightPanelContent={
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <h2 className="font-semibold">Recent Projects</h2>
            <div className="space-y-2">
              {(dashboard?.projects || []).map((project: any) => (
                <div
                  key={project.id}
                  className="p-3 rounded border hover-elevate cursor-pointer"
                  data-testid={`project-card-${project.id}`}
                >
                  <h3 className="font-medium text-sm">{project.name}</h3>
                  <p className="text-xs text-muted-foreground">{project.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );
}
