import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AdminGuard } from '@/components/admin-guard';
import { MetaSySopChat } from '@/components/meta-sysop-chat';
import { CheckCircle, AlertTriangle, GitBranch, Database, Wrench } from 'lucide-react';

function PlatformHealingContent() {
  const [autoCommit, setAutoCommit] = useState(false);
  const [autoPush, setAutoPush] = useState(false);

  const { data: status } = useQuery<any>({
    queryKey: ['/api/platform/status'],
  });

  const { data: backupsData } = useQuery<any>({
    queryKey: ['/api/platform/backups'],
  });

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b p-2 sm:p-4 bg-background">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-2xl font-bold leading-tight">Meta-SySop<span className="hidden sm:inline"> Platform Healing</span></h1>
                <p className="hidden sm:block text-sm text-muted-foreground">
                  Chat with Meta-SySop to diagnose and fix platform issues
                </p>
              </div>
            </div>
            <Badge variant={status?.safety?.safe ? 'default' : 'destructive'} className="flex-shrink-0 text-xs h-6">
              {status?.safety?.safe ? 'Healthy' : 'Issues'}
            </Badge>
          </div>

          {/* Settings - Compact on mobile */}
          <div className="flex items-center gap-3 sm:gap-6 mt-2 sm:mt-4 p-2 sm:p-3 bg-muted/50 rounded-lg text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <Switch
                id="auto-commit"
                checked={autoCommit}
                onCheckedChange={setAutoCommit}
                data-testid="switch-auto-commit"
              />
              <Label htmlFor="auto-commit" className="cursor-pointer flex items-center gap-1 leading-tight">
                <GitBranch className="h-3 w-3 flex-shrink-0" />
                <span>Auto-commit</span>
              </Label>
            </div>

            <div className="flex items-center gap-1.5">
              <Switch
                id="auto-push"
                checked={autoPush}
                onCheckedChange={setAutoPush}
                disabled={!autoCommit}
                data-testid="switch-auto-push"
              />
              <Label htmlFor="auto-push" className="cursor-pointer flex items-center gap-1 leading-tight">
                <CheckCircle className="h-3 w-3 flex-shrink-0" />
                <span>Auto-push</span>
              </Label>
            </div>
          </div>
        </div>

        {/* Mobile Status Bar - Compact */}
        <div className="lg:hidden border-b px-2 py-1.5 bg-muted/20 flex items-center justify-between gap-2 text-[10px] overflow-x-auto">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Status:</span>
            {status?.safety?.safe ? (
              <Badge variant="default" className="text-[10px] h-5 px-1.5">Safe</Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">Issues</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Changes:</span>
            <Badge variant={status?.uncommittedChanges ? 'secondary' : 'outline'} className="text-[10px] h-5 px-1.5">
              {status?.uncommittedChanges ? 'Yes' : 'No'}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Backups:</span>
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">{backupsData?.backups?.length || 0}</Badge>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          <MetaSySopChat 
            autoCommit={autoCommit}
            autoPush={autoPush}
          />
        </div>
      </div>

      {/* Sidebar with Platform Status - Hidden on mobile */}
      <div className="hidden lg:block lg:w-80 border-l p-4 bg-muted/20 overflow-y-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              Platform Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Uncommitted Changes</span>
              <Badge variant={status?.uncommittedChanges ? 'secondary' : 'outline'}>
                {status?.uncommittedChanges ? 'Yes' : 'No'}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Safety Status</span>
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

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Backups Available</span>
              <Badge variant="outline">{backupsData?.backups?.length || 0}</Badge>
            </div>

            {status?.safety?.issues && status.safety.issues.length > 0 && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                <p className="text-xs font-medium text-destructive mb-2">Safety Issues:</p>
                <ul className="list-disc list-inside text-xs text-destructive space-y-1">
                  {status.safety.issues.map((issue: string, i: number) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Healing Sessions</CardTitle>
            <CardDescription className="text-xs">
              Previous platform modifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground text-center py-4">
              All healing history is now in the chat above
            </p>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tips</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2 text-muted-foreground">
            <p>• Be specific about the issue you're experiencing</p>
            <p>• Meta-SySop can read and modify platform files</p>
            <p>• Enable auto-commit to save changes to Git</p>
            <p>• Enable auto-push to deploy fixes immediately</p>
            <p>• All changes are backed up automatically</p>
          </CardContent>
        </Card>
      </div>
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
