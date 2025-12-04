/**
 * Project Protection Settings Component
 * Users can customize which files are critical, sensitive, or editable in their project
 */

import { useState } from 'react';
import { Shield, AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface ProjectProtectionSettingsProps {
  projectId: string;
}

export function ProjectProtectionSettings({ projectId }: ProjectProtectionSettingsProps) {
  const { toast } = useToast();
  const [newProtectedFile, setNewProtectedFile] = useState('');

  // Fetch project config
  const { data: config, isLoading } = useQuery({
    queryKey: [`/api/projects/${projectId}/config`],
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await fetch(`/api/projects/${projectId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update configuration');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Settings Updated', description: 'Project protection settings saved' });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/config`] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update settings', variant: 'destructive' });
    },
  });

  const handleAddProtectedFile = () => {
    if (!newProtectedFile.trim()) return;

    const updated = [...(config?.protectedFiles || []), newProtectedFile];
    updateConfigMutation.mutate({ protectedFiles: updated });
    setNewProtectedFile('');
  };

  const handleRemoveProtectedFile = (file: string) => {
    const updated = (config?.protectedFiles || []).filter((f: string) => f !== file);
    updateConfigMutation.mutate({ protectedFiles: updated });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Project Protection Settings
          </CardTitle>
          <CardDescription>
            Define which files are critical, sensitive, or can be freely edited
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Protected Files Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Critical Files (Cannot Be Modified)</h3>
              <Badge variant="destructive">Protected</Badge>
            </div>

            <Alert className="bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Critical files cannot be modified without admin intervention
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              {config?.protectedFiles?.map((file: string) => (
                <div
                  key={file}
                  className="flex items-center justify-between p-2 rounded border border-destructive/20 bg-destructive/5"
                  data-testid={`protected-file-${file}`}
                >
                  <code className="text-sm">{file}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveProtectedFile(file)}
                    data-testid={`button-remove-protected-${file}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Add protected file (e.g., src/index.ts)"
                value={newProtectedFile}
                onChange={(e) => setNewProtectedFile(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddProtectedFile()}
                data-testid="input-add-protected-file"
              />
              <Button
                onClick={handleAddProtectedFile}
                disabled={updateConfigMutation.isPending}
                data-testid="button-add-protected-file"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          {/* Editable Files Section */}
          <div className="space-y-3 p-4 rounded-lg bg-green-50/50 border border-green-200/30">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Editable Files</h3>
              <Badge variant="outline" className="border-green-500 text-green-700">
                Allowed
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              These files can be freely modified without approval
            </p>
            <ul className="text-sm space-y-1">
              <li>✓ src/**/*.tsx - React components</li>
              <li>✓ src/**/*.ts - TypeScript files</li>
              <li>✓ src/styles/**/* - CSS/styling</li>
              <li>✓ README.md - Documentation</li>
            </ul>
          </div>

          {/* Approval Requirements */}
          <div className="space-y-3 p-4 rounded-lg bg-amber-50/50 border border-amber-200/30">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Operations Requiring Approval
            </h3>
            <div className="text-sm space-y-1">
              {(config?.requireApprovalFor || []).map((op: string) => (
                <div key={op} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-amber-600" />
                  {op}
                </div>
              ))}
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="space-y-3 p-4 rounded-lg bg-blue-50/50 border border-blue-200/30">
            <h3 className="font-semibold">Your Approval Authority</h3>
            <p className="text-sm text-muted-foreground">
              As project owner, you review and approve changes to protected files
            </p>
            <Button variant="outline" size="sm" data-testid="button-view-approvals">
              View Pending Approvals
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
