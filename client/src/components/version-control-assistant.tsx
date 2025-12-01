/**
 * Version Control Assistant - Git operations helper
 * Helps users understand commits, branches, and version history
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  GitBranch, GitCommit, GitMerge, RefreshCw, 
  Plus, Check, AlertCircle, Clock, FileCode, 
  ArrowUpRight, Loader2, History, Undo2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Commit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  filesChanged: number;
}

interface Branch {
  name: string;
  current: boolean;
  lastCommit: string;
  ahead: number;
  behind: number;
}

interface GitStatus {
  modified: string[];
  staged: string[];
  untracked: string[];
  deleted: string[];
}

interface VersionControlAssistantProps {
  projectId?: string;
  className?: string;
}

export function VersionControlAssistant({ projectId, className }: VersionControlAssistantProps) {
  const [commitMessage, setCommitMessage] = useState('');
  const [activeTab, setActiveTab] = useState('status');
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<GitStatus>({
    queryKey: ['/api/git/status', projectId],
    enabled: !!projectId,
  });

  const { data: commits, isLoading: commitsLoading } = useQuery<Commit[]>({
    queryKey: ['/api/git/commits', projectId],
    enabled: !!projectId && activeTab === 'history',
  });

  const { data: branches, isLoading: branchesLoading } = useQuery<Branch[]>({
    queryKey: ['/api/git/branches', projectId],
    enabled: !!projectId && activeTab === 'branches',
  });

  const commitMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest('/api/git/commit', {
        method: 'POST',
        body: JSON.stringify({ projectId, message }),
      });
    },
    onSuccess: () => {
      setCommitMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/git/status', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/git/commits', projectId] });
      toast({
        title: 'Committed successfully',
        description: 'Your changes have been saved',
        variant: 'success',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Commit failed',
        description: error.message || 'Failed to commit changes',
        variant: 'destructive',
      });
    },
  });

  const stageAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/git/stage-all', {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      });
    },
    onSuccess: () => {
      refetchStatus();
      toast({ title: 'All files staged' });
    },
  });

  const revertMutation = useMutation({
    mutationFn: async (commitHash: string) => {
      return apiRequest('/api/git/revert', {
        method: 'POST',
        body: JSON.stringify({ projectId, commitHash }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/git/status', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/git/commits', projectId] });
      toast({
        title: 'Reverted successfully',
        description: 'Changes have been undone',
      });
    },
  });

  const totalChanges = status 
    ? status.modified.length + status.staged.length + status.untracked.length + status.deleted.length 
    : 0;

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="version-control-assistant">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-zinc-50 dark:from-slate-950/50 dark:to-zinc-950/50 border-b py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-slate-600" />
            <CardTitle className="text-base">Version Control</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => refetchStatus()}
            data-testid="button-refresh-git"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full rounded-none border-b bg-muted/30 p-0 h-auto">
          <TabsTrigger value="status" className="rounded-none data-[state=active]:bg-background flex-1 py-2">
            <FileCode className="w-4 h-4 mr-1" />
            Status
            {totalChanges > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                {totalChanges}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-none data-[state=active]:bg-background flex-1 py-2">
            <History className="w-4 h-4 mr-1" />
            History
          </TabsTrigger>
          <TabsTrigger value="branches" className="rounded-none data-[state=active]:bg-background flex-1 py-2">
            <GitMerge className="w-4 h-4 mr-1" />
            Branches
          </TabsTrigger>
        </TabsList>

        <CardContent className="p-0">
          {/* Status Tab */}
          <TabsContent value="status" className="m-0">
            {statusLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !status ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No project selected or Git not initialized
              </div>
            ) : totalChanges === 0 ? (
              <div className="p-8 text-center">
                <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Working directory clean</p>
              </div>
            ) : (
              <div className="divide-y">
                {/* Staged Files */}
                {status.staged.length > 0 && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                        Staged ({status.staged.length})
                      </Badge>
                    </div>
                    <ScrollArea className="max-h-24">
                      {status.staged.map((file) => (
                        <div key={file} className="text-xs font-mono py-0.5 text-green-600 flex items-center gap-1">
                          <Plus className="w-3 h-3" />
                          {file}
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                {/* Modified Files */}
                {status.modified.length > 0 && (
                  <div className="p-3">
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 mb-2">
                      Modified ({status.modified.length})
                    </Badge>
                    <ScrollArea className="max-h-24">
                      {status.modified.map((file) => (
                        <div key={file} className="text-xs font-mono py-0.5 text-amber-600">
                          ~ {file}
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                {/* Untracked Files */}
                {status.untracked.length > 0 && (
                  <div className="p-3">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 mb-2">
                      Untracked ({status.untracked.length})
                    </Badge>
                    <ScrollArea className="max-h-24">
                      {status.untracked.map((file) => (
                        <div key={file} className="text-xs font-mono py-0.5 text-blue-600">
                          ? {file}
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                {/* Commit Form */}
                <div className="p-3 space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => stageAllMutation.mutate()}
                    disabled={stageAllMutation.isPending || status.staged.length === totalChanges}
                    data-testid="button-stage-all"
                  >
                    {stageAllMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-1" />
                    )}
                    Stage All Changes
                  </Button>
                  <Textarea
                    placeholder="Commit message..."
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="min-h-[60px] text-sm resize-none"
                    data-testid="textarea-commit-message"
                  />
                  <Button
                    className="w-full"
                    disabled={!commitMessage.trim() || commitMutation.isPending || status.staged.length === 0}
                    onClick={() => commitMutation.mutate(commitMessage)}
                    data-testid="button-commit"
                  >
                    {commitMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <GitCommit className="w-4 h-4 mr-1" />
                    )}
                    Commit Changes
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="m-0">
            {commitsLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !commits?.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No commit history yet
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="divide-y">
                  {commits.map((commit) => (
                    <div 
                      key={commit.hash} 
                      className="p-3 hover:bg-muted/30 transition-colors group"
                      data-testid={`commit-${commit.shortHash}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{commit.message}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <code className="font-mono">{commit.shortHash}</code>
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {new Date(commit.date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => revertMutation.mutate(commit.hash)}
                          title="Revert to this commit"
                          data-testid={`button-revert-${commit.shortHash}`}
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Branches Tab */}
          <TabsContent value="branches" className="m-0">
            {branchesLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !branches?.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No branches found
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="divide-y">
                  {branches.map((branch) => (
                    <div 
                      key={branch.name} 
                      className={cn(
                        "p-3 flex items-center justify-between",
                        branch.current && "bg-primary/5"
                      )}
                      data-testid={`branch-${branch.name}`}
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className={cn(
                          "w-4 h-4",
                          branch.current ? "text-primary" : "text-muted-foreground"
                        )} />
                        <span className={cn(
                          "text-sm font-medium",
                          branch.current && "text-primary"
                        )}>
                          {branch.name}
                        </span>
                        {branch.current && (
                          <Badge variant="secondary" className="text-xs">current</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {branch.ahead > 0 && (
                          <span className="text-green-600">↑{branch.ahead}</span>
                        )}
                        {branch.behind > 0 && (
                          <span className="text-amber-600">↓{branch.behind}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

export default VersionControlAssistant;
