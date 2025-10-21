import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle, XCircle, History, Database, FileCode, GitBranch } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AdminGuard } from '@/components/admin-guard';

function PlatformHealingContent() {
  const [issue, setIssue] = useState('');
  const [autoCommit, setAutoCommit] = useState(false);
  const [autoPush, setAutoPush] = useState(false);
  const { toast } = useToast();

  const { data: status } = useQuery({
    queryKey: ['/api/platform/status'],
  });

  const { data: backupsData } = useQuery({
    queryKey: ['/api/platform/backups'],
  });

  const { data: auditData } = useQuery({
    queryKey: ['/api/platform/audit'],
  });

  const healMutation = useMutation({
    mutationFn: async (data: { issue: string; autoCommit: boolean; autoPush: boolean }) => {
      return apiRequest('/api/platform/heal', 'POST', data);
    },
    onSuccess: (data) => {
      toast({
        title: 'Platform Healing Complete',
        description: `Successfully fixed the issue. ${data.changes?.length || 0} files modified.`,
      });
      setIssue('');
      queryClient.invalidateQueries({ queryKey: ['/api/platform/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/audit'] });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/backups'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Healing Failed',
        description: error.message || 'Failed to heal platform',
        variant: 'destructive',
      });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async (backupId: string) => {
      return apiRequest('/api/platform/rollback', 'POST', { backupId });
    },
    onSuccess: () => {
      toast({
        title: 'Rollback Complete',
        description: 'Platform restored to backup successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/audit'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Rollback Failed',
        description: error.message || 'Failed to rollback',
        variant: 'destructive',
      });
    },
  });

  const handleHeal = () => {
    if (!issue.trim()) {
      toast({
        title: 'Issue Required',
        description: 'Please describe the platform issue to fix',
        variant: 'destructive',
      });
      return;
    }

    healMutation.mutate({ issue, autoCommit, autoPush });
  };

  const handleRollback = (backupId: string) => {
    if (confirm('Are you sure you want to rollback to this backup? This will overwrite current changes.')) {
      rollbackMutation.mutate(backupId);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meta-SySop Platform Healing</h1>
          <p className="text-muted-foreground mt-1">
            Let SySop self-diagnose and fix Archetype platform issues
          </p>
        </div>
        <Badge variant={status?.safety?.safe ? 'default' : 'destructive'}>
          {status?.safety?.safe ? 'Platform Healthy' : 'Issues Detected'}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              Submit Platform Issue
            </CardTitle>
            <CardDescription>
              Describe a bug, UI issue, or improvement for SySop to implement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              data-testid="input-platform-issue"
              placeholder="Example: The login button on the landing page is not visible on dark backgrounds. Fix the styling to have white text and a visible border."
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              className="min-h-32"
            />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-commit" className="text-sm">
                  Auto-commit changes
                </Label>
                <Switch
                  id="auto-commit"
                  checked={autoCommit}
                  onCheckedChange={setAutoCommit}
                  data-testid="switch-auto-commit"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-push" className="text-sm">
                  Auto-push to Render (triggers deployment)
                </Label>
                <Switch
                  id="auto-push"
                  checked={autoPush}
                  onCheckedChange={setAutoPush}
                  disabled={!autoCommit}
                  data-testid="switch-auto-push"
                />
              </div>
            </div>

            <Button
              data-testid="button-heal-platform"
              onClick={handleHeal}
              disabled={healMutation.isPending}
              className="w-full"
            >
              {healMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  SySop is healing the platform...
                </>
              ) : (
                'Heal Platform'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Platform Status
            </CardTitle>
            <CardDescription>Current platform health and safety checks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Uncommitted Changes</span>
              <Badge variant={status?.uncommittedChanges ? 'secondary' : 'outline'}>
                {status?.uncommittedChanges ? 'Yes' : 'No'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Safety Status</span>
              {status?.safety?.safe ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Safe
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Issues
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Backups Available</span>
              <Badge variant="outline">{backupsData?.backups?.length || 0}</Badge>
            </div>

            {status?.safety?.issues && status.safety.issues.length > 0 && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                <p className="text-sm font-medium text-destructive mb-2">Safety Issues:</p>
                <ul className="list-disc list-inside text-sm text-destructive">
                  {status.safety.issues.map((issue: string, i: number) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Backups & Rollback
          </CardTitle>
          <CardDescription>
            Automatic backups created before each healing operation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupsData?.backups && backupsData.backups.length > 0 ? (
            <div className="space-y-2">
              {backupsData.backups.slice(0, 10).map((backup: any) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{backup.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Commit: {backup.commitHash.slice(0, 8)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRollback(backup.id)}
                    disabled={rollbackMutation.isPending}
                    data-testid={`button-rollback-${backup.id}`}
                  >
                    Rollback
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No backups available yet
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Healing History
          </CardTitle>
          <CardDescription>Recent platform modifications and fixes</CardDescription>
        </CardHeader>
        <CardContent>
          {auditData?.logs && auditData.logs.length > 0 ? (
            <div className="space-y-2">
              {auditData.logs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border"
                >
                  {log.status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  ) : log.status === 'failure' ? (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{log.description}</p>
                      <Badge variant="outline" className="text-xs">
                        {log.action}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                    {log.error && (
                      <p className="text-xs text-destructive">{log.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No healing history yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PlatformHealing() {
  return (
    <AdminGuard>
      <PlatformHealingContent />
    </AdminGuard>
  );
}
