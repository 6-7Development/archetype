/**
 * Admin Workspace
 * Admin/platform owner view for managing projects and platform health
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { WorkspaceContainer } from '@/components/workspace-container';
import { workspacePresets } from '@/hooks/useWorkspaceConfig';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function AdminWorkspace() {
  const { user } = useAuth();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Fetch admin data
  const { data: adminData, isLoading } = useQuery({
    queryKey: ['/api/admin/overview'],
    enabled: user?.isOwner || user?.role === 'admin',
  });

  if (isLoading) return <Skeleton className="w-full h-screen" />;
  if (!user?.isOwner && user?.role !== 'admin') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Access Denied</p>
          <p className="text-muted-foreground">Admin access required</p>
        </div>
      </div>
    );
  }

  // Convert admin data to tasks
  const tasks = [
    {
      id: 'health_check',
      title: 'Platform Health Check',
      status: (adminData?.platformHealth || 'good') === 'good' ? 'completed' : 'pending',
      description: 'Monitor platform status',
    },
    {
      id: 'user_projects',
      title: `${adminData?.totalProjects || 0} User Projects`,
      status: 'in_progress' as const,
      description: 'View and manage user projects',
      subtasks: adminData?.activeProjects || 0,
    },
    {
      id: 'incidents',
      title: `${adminData?.incidents?.length || 0} Active Incidents`,
      status: adminData?.incidents?.length ? 'pending' : 'completed',
      description: 'Platform incidents requiring attention',
    },
  ];

  const config = workspacePresets.adminProject('platform', 'Admin Control Panel', tasks);

  return (
    <WorkspaceContainer
      {...config}
      onTaskSelect={setSelectedProject}
      rightPanelContent={
        <div className="p-4 space-y-4">
          {/* Admin Controls */}
          <div className="space-y-3">
            <h2 className="font-semibold">Admin Controls</h2>

            <div className="space-y-2">
              <Button className="w-full justify-start" variant="outline" data-testid="button-view-users">
                View All Users
              </Button>
              <Button className="w-full justify-start" variant="outline" data-testid="button-view-projects">
                Manage Projects
              </Button>
              <Button className="w-full justify-start" variant="outline" data-testid="button-view-incidents">
                View Incidents
              </Button>
              <Button className="w-full justify-start" variant="outline" data-testid="button-platform-settings">
                Platform Settings
              </Button>
            </div>
          </div>

          {/* Platform Health */}
          <div className="space-y-2 p-3 rounded border">
            <h3 className="text-sm font-semibold">Platform Status</h3>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Health</span>
              <Badge variant={adminData?.platformHealth === 'good' ? 'default' : 'destructive'}>
                {adminData?.platformHealth || 'good'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Users</span>
              <Badge variant="outline">{adminData?.totalUsers || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Projects</span>
              <Badge variant="outline">{adminData?.totalProjects || 0}</Badge>
            </div>
          </div>

          {/* Recent Incidents */}
          {adminData?.incidents && adminData.incidents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-red-600">Recent Incidents</h3>
              {adminData.incidents.map((incident: any) => (
                <div
                  key={incident.id}
                  className="p-2 rounded border border-red-200 bg-red-50/50 text-xs"
                  data-testid={`incident-${incident.id}`}
                >
                  <p className="font-medium">{incident.title}</p>
                  <p className="text-red-700">{incident.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}
