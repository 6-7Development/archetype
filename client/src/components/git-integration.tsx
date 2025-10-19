import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { GitBranch, GitMerge, RefreshCw, Trash2, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface GitIntegrationProps {
  projectId: string;
}

interface GitRepository {
  id: string;
  provider: string;
  repoUrl: string;
  repoName: string;
  branch: string;
  syncStatus: string;
  lastSyncedAt?: string;
}

export function GitIntegration({ projectId }: GitIntegrationProps) {
  const [showConnect, setShowConnect] = useState(false);
  const [provider, setProvider] = useState("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [repoName, setRepoName] = useState("");
  const [branch, setBranch] = useState("main");
  const [accessToken, setAccessToken] = useState("");
  const { toast } = useToast();

  const { data: repository } = useQuery<{ repository?: GitRepository }>({
    queryKey: [`/api/projects/${projectId}/git`],
  });

  const connectMutation = useMutation({
    mutationFn: async (data: { provider: string; repoUrl: string; repoName: string; branch: string; accessToken?: string }) => {
      return await apiRequest("POST", `/api/projects/${projectId}/git/connect`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git`] });
      setShowConnect(false);
      setRepoUrl("");
      setRepoName("");
      setBranch("main");
      setAccessToken("");
      toast({ title: "Git repository connected" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", description: error.message });
    }
  });

  const syncMutation = useMutation({
    mutationFn: async (status: string) => {
      return await apiRequest("POST", `/api/projects/${projectId}/git/sync`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git`] });
      toast({ title: "Repository synced" });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/projects/${projectId}/git`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/git`] });
      toast({ title: "Git repository disconnected" });
    }
  });

  const handleConnect = () => {
    if (!repoUrl.trim() || !repoName.trim()) {
      toast({ variant: "destructive", description: "Repository URL and name are required" });
      return;
    }
    connectMutation.mutate({ provider, repoUrl, repoName, branch, accessToken });
  };

  const handleSync = () => {
    syncMutation.mutate("syncing");
  };

  const repo = repository?.repository;

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500",
    syncing: "bg-blue-500",
    synced: "bg-green-500",
    failed: "bg-red-500",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Git Integration
            </CardTitle>
            <CardDescription>
              Sync your project with GitHub, GitLab, or Bitbucket
            </CardDescription>
          </div>
          {!repo && (
            <Dialog open={showConnect} onOpenChange={setShowConnect}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-connect-git">
                  <GitMerge className="w-4 h-4 mr-2" />
                  Connect Repository
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect Git Repository</DialogTitle>
                  <DialogDescription>
                    Link your project to a Git repository for version control
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="provider">Provider</Label>
                    <Select value={provider} onValueChange={setProvider}>
                      <SelectTrigger id="provider" data-testid="select-git-provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="github">GitHub</SelectItem>
                        <SelectItem value="gitlab">GitLab</SelectItem>
                        <SelectItem value="bitbucket">Bitbucket</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="repo-url">Repository URL</Label>
                    <Input
                      id="repo-url"
                      data-testid="input-repo-url"
                      placeholder="https://github.com/username/repo"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="repo-name">Repository Name</Label>
                    <Input
                      id="repo-name"
                      data-testid="input-repo-name"
                      placeholder="username/repo"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="branch">Branch</Label>
                    <Input
                      id="branch"
                      data-testid="input-branch"
                      placeholder="main"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="access-token">Access Token (optional)</Label>
                    <Input
                      id="access-token"
                      data-testid="input-access-token"
                      type="password"
                      placeholder="ghp_..."
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={connectMutation.isPending}
                    data-testid="button-save-git-connection"
                    className="w-full"
                  >
                    {connectMutation.isPending ? "Connecting..." : "Connect Repository"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {repo ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{repo.repoName}</p>
                  <Badge variant="outline" className="capitalize">
                    {repo.provider}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <GitBranch className="w-3 h-3" />
                  <span>{repo.branch}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusColors[repo.syncStatus] || 'bg-gray-500'}`} />
                  <span className="text-xs capitalize">{repo.syncStatus}</span>
                  {repo.lastSyncedAt && (
                    <span className="text-xs text-muted-foreground">
                      · Last synced {new Date(repo.lastSyncedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  data-testid="button-sync-git"
                >
                  <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect-git"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <a
              href={repo.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
              data-testid="link-repo-url"
            >
              View on {repo.provider}
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No Git repository connected</p>
        )}
      </CardContent>
    </Card>
  );
}
