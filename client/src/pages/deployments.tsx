import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, Plus, ExternalLink, RefreshCw, Trash2, Globe, Clock } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { NewDeploymentModal } from "@/components/new-deployment-modal";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Deployment } from "@shared/schema";

export default function DeploymentsPage() {
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const { toast } = useToast();

  // Fetch deployments with polling for real-time updates
  const { data: deployments, isLoading } = useQuery<Deployment[]>({
    queryKey: ['/api/deployments'],
    refetchInterval: (query) => {
      // Poll every 5 seconds if any deployment is building
      const data = query.state.data;
      const hasBuilding = data?.some(d => d.status === 'building' || d.status === 'pending' || d.status === 'deploying');
      return hasBuilding ? 5000 : false;
    },
  });

  // Delete deployment mutation
  const deleteMutation = useMutation({
    mutationFn: async (deploymentId: string) => {
      return apiRequest('DELETE', `/api/deployments/${deploymentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deployments'] });
      toast({
        title: "Deployment deleted",
        description: "The deployment has been removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete deployment",
      });
    },
  });

  // Get status badge variant and text
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

  const handleDelete = async (deploymentId: string, subdomain: string) => {
    if (confirm(`Are you sure you want to delete deployment "${subdomain}"? This cannot be undone.`)) {
      deleteMutation.mutate(deploymentId);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-deployments-title">
              <Rocket className="w-8 h-8" />
              Deployments
            </h1>
            <p className="text-muted-foreground mt-1">
              Deploy your projects to production with Cloudflare Pages
            </p>
          </div>
          <Button
            onClick={() => setIsNewModalOpen(true)}
            size="default"
            data-testid="button-new-deployment"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Deployment
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="hover-elevate">
                <CardHeader className="space-y-2">
                  <div className="h-6 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && deployments && deployments.length === 0 && (
          <Card className="border-dashed" data-testid="card-empty-state">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="rounded-full bg-muted p-6">
                <Rocket className="w-12 h-12 text-muted-foreground" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold">No deployments yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">
                  Get started by deploying your first project
                </p>
                <Button onClick={() => setIsNewModalOpen(true)} data-testid="button-create-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Deployment
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deployments Grid */}
        {!isLoading && deployments && deployments.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {deployments.map((deployment) => {
              const statusBadge = getStatusBadge(deployment.status);
              
              return (
                <Card key={deployment.id} className="hover-elevate" data-testid={`card-deployment-${deployment.id}`}>
                  <CardHeader className="gap-2 space-y-0 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg font-semibold truncate" data-testid={`text-subdomain-${deployment.id}`}>
                        {deployment.subdomain}.beehive.app
                      </CardTitle>
                      <Badge
                        className={statusBadge.className}
                        data-testid={`badge-status-${deployment.id}`}
                      >
                        {statusBadge.text}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      {deployment.environment === 'production' ? '🚀 Production' : '🔍 Preview'}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* URLs */}
                    {deployment.cfUrl && (
                      <div className="space-y-2">
                        <a
                          href={deployment.cfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                          data-testid={`link-url-${deployment.id}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Live Site
                        </a>
                        {deployment.customDomain && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Globe className="w-3 h-3" />
                            {deployment.customDomain}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {deployment.deployedAt ? (
                        <>Deployed {formatDistanceToNow(new Date(deployment.deployedAt))} ago</>
                      ) : (
                        <>Created {formatDistanceToNow(new Date(deployment.createdAt))} ago</>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Link href={`/deployments/${deployment.id}`}>
                        <Button variant="outline" size="sm" className="flex-1" data-testid={`button-view-${deployment.id}`}>
                          View Details
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(deployment.id, deployment.subdomain)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${deployment.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* New Deployment Modal */}
      <NewDeploymentModal
        open={isNewModalOpen}
        onOpenChange={setIsNewModalOpen}
      />
    </div>
  );
}
