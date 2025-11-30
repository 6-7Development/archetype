import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, RefreshCw, Trash2, ExternalLink, Globe, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import type { Deployment, DeploymentLog, CustomDomain } from "@shared/schema";

export default function DeploymentDetailsPage() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [customDomain, setCustomDomain] = useState("");
  const [dnsInstructions, setDnsInstructions] = useState<any[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch deployment
  const { data: deployment, isLoading } = useQuery<Deployment>({
    queryKey: ['/api/deployments', deploymentId],
    enabled: !!deploymentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return (status === 'building' || status === 'pending' || status === 'deploying') ? 3000 : false;
    },
  });

  // Fetch build logs
  const { data: logs = [] } = useQuery<DeploymentLog[]>({
    queryKey: ['/api/deployments', deploymentId, 'logs'],
    enabled: !!deploymentId && !!deployment?.buildJobId,
    refetchInterval: (query) => {
      const dep = queryClient.getQueryData<Deployment>(['/api/deployments', deploymentId]);
      return (dep?.status === 'building' || dep?.status === 'deploying') ? 2000 : false;
    },
  });

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logs && logs.length > 0) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Rebuild mutation
  const rebuildMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/deployments/${deploymentId}/rebuild`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployments', deploymentId] });
      toast({
        title: "Rebuild started",
        description: "Your deployment is being rebuilt",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to rebuild deployment",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/deployments/${deploymentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Deployment deleted",
        description: "Redirecting to deployments page...",
      });
      setTimeout(() => navigate('/deployments'), 1000);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete deployment",
      });
    },
  });

  // Add custom domain mutation
  const addDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      return apiRequest('POST', `/api/deployments/${deploymentId}/custom-domain`, { domain });
    },
    onSuccess: (data: any) => {
      setDnsInstructions(data.dnsInstructions || []);
      queryClient.invalidateQueries({ queryKey: ['/api/deployments', deploymentId] });
      toast({
        title: "Custom domain added",
        description: "Follow the DNS instructions below to verify your domain",
      });
      setCustomDomain("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add custom domain",
      });
    },
  });

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete this deployment? This cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (customDomain.trim()) {
      addDomainMutation.mutate(customDomain.trim().toLowerCase());
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: "Copied to clipboard" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { variant: 'default' as const, text: 'Active', className: 'bg-green-600 hover-elevate' };
      case 'building':
        return { variant: 'secondary' as const, text: 'Building', className: 'bg-yellow-600 hover-elevate' };
      case 'deploying':
        return { variant: 'secondary' as const, text: 'Deploying', className: 'bg-blue-600 hover-elevate' };
      case 'failed':
        return { variant: 'destructive' as const, text: 'Failed', className: 'bg-red-600 hover-elevate' };
      case 'pending':
        return { variant: 'outline' as const, text: 'Pending', className: 'hover-elevate' };
      default:
        return { variant: 'outline' as const, text: status, className: 'hover-elevate' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
          <Card>
            <CardHeader>
              <div className="h-6 bg-muted rounded animate-pulse w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold">Deployment not found</h3>
              <p className="text-muted-foreground mt-2">
                This deployment may have been deleted or doesn't exist
              </p>
              <Button onClick={() => navigate('/deployments')} className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Deployments
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge(deployment.status);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/deployments')}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-deployment-title">
                {deployment.subdomain}.beehive.app
              </h1>
              <p className="text-sm text-muted-foreground">
                {deployment.environment === 'production' ? 'Production' : 'Preview'} Deployment
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => rebuildMutation.mutate()}
              disabled={rebuildMutation.isPending || deployment.status === 'building'}
              data-testid="button-rebuild"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${rebuildMutation.isPending ? 'animate-spin' : ''}`} />
              Rebuild
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-delete"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Overview */}
        <Card data-testid="card-overview">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  <Badge className={statusBadge.className} data-testid="badge-status">
                    {statusBadge.text}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Environment</Label>
                <p className="mt-1">{deployment.environment}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Branch</Label>
                <p className="mt-1">{deployment.branch || 'main'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p className="mt-1 text-sm">
                  {formatDistanceToNow(new Date(deployment.createdAt))} ago
                </p>
              </div>
            </div>

            {deployment.cfUrl && (
              <div>
                <Label className="text-muted-foreground">Deployment URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <a
                    href={deployment.cfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                    data-testid="link-deployment-url"
                  >
                    {deployment.cfUrl}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(deployment.cfUrl || '')}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}

            {deployment.deployedAt && (
              <div>
                <Label className="text-muted-foreground">Last Deployed</Label>
                <p className="mt-1 text-sm">
                  {new Date(deployment.deployedAt).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Build Logs */}
        <Card data-testid="card-build-logs">
          <CardHeader>
            <CardTitle>Build Logs</CardTitle>
            <CardDescription>
              {deployment.status === 'building' && 'Building in progress...'}
              {deployment.status === 'active' && 'Build completed successfully'}
              {deployment.status === 'failed' && 'Build failed - check logs for errors'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 w-full rounded-md border bg-muted/30 p-4">
              <div className="font-mono text-xs space-y-1">
                {logs.length === 0 && (
                  <p className="text-muted-foreground">No logs available yet...</p>
                )}
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`${
                      log.level === 'error' ? 'text-red-500' :
                      log.level === 'warn' ? 'text-yellow-500' :
                      'text-foreground'
                    }`}
                    data-testid={`log-line-${index}`}
                  >
                    {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Custom Domain */}
        <Card data-testid="card-custom-domain">
          <CardHeader>
            <CardTitle>Custom Domain</CardTitle>
            <CardDescription>
              Add a custom domain to your deployment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!deployment.customDomain && (
              <form onSubmit={handleAddDomain} className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="custom-domain">Domain</Label>
                  <Input
                    id="custom-domain"
                    placeholder="example.com"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    data-testid="input-custom-domain"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={addDomainMutation.isPending || !customDomain.trim()}
                  data-testid="button-add-domain"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Add Domain
                </Button>
              </form>
            )}

            {deployment.customDomain && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
                  <Globe className="w-4 h-4" />
                  <span className="font-medium">{deployment.customDomain}</span>
                  <Badge variant="outline" className="ml-auto">Configured</Badge>
                </div>
              </div>
            )}

            {dnsInstructions.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <div>
                  <h4 className="font-semibold mb-2">DNS Configuration</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add these DNS records to your domain provider:
                  </p>
                  {dnsInstructions.map((instruction, index) => (
                    <div key={index} className="space-y-2 mb-4 p-3 rounded-md bg-muted">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">{instruction.type} Record</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(instruction.value)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="text-xs space-y-1">
                        <div><span className="text-muted-foreground">Name:</span> {instruction.name}</div>
                        <div><span className="text-muted-foreground">Value:</span> <code className="bg-background px-1 py-0.5 rounded">{instruction.value}</code></div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{instruction.instructions}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
