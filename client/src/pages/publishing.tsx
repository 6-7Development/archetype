import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Globe,
  Activity,
  Settings,
  FileText,
  BarChart3,
  Database,
  Loader2,
  ExternalLink,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Deployment } from "@shared/schema";

// Publishing status check result
interface PublishingCheck {
  name: string;
  status: "pending" | "running" | "success" | "warning" | "error";
  message: string;
  icon?: typeof CheckCircle2;
}

export default function Publishing() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingProgress, setPublishingProgress] = useState(0);
  
  // Mock deployment checks (will be replaced with real API)
  const [checks, setChecks] = useState<PublishingCheck[]>([
    {
      name: "Development database changes detected",
      status: "success",
      message: "Schema changes identified",
    },
    {
      name: "Generated migrations to apply to production database",
      status: "success",
      message: "Migrations ready",
    },
  ]);

  const { data: deployments = [] } = useQuery<Deployment[]>({
    queryKey: ["/api/deployments"],
  });

  const activeDeployment = deployments[0];

  const startPublishing = useMutation({
    mutationFn: async () => {
      setIsPublishing(true);
      setPublishingProgress(0);
      
      // Simulate publishing process
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setPublishingProgress(i);
      }
      
      return await apiRequest("POST", "/api/deployments/publish", {});
    },
    onSuccess: () => {
      setIsPublishing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      toast({
        title: "Published successfully",
        description: "Your app is now live!",
      });
    },
    onError: () => {
      setIsPublishing(false);
      toast({
        title: "Publishing failed",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const pauseDeployment = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/deployments/pause", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deployments"] });
      toast({ description: "Deployment paused" });
    },
  });

  return (
    <div className="flex-1 overflow-y-auto" data-testid="page-publishing">
      {/* Mobile-First Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-3 sm:px-6 h-14">
          <div className="flex items-center gap-2 sm:gap-3">
            <Globe className="w-5 h-5 text-primary" />
            <h1 className="text-lg sm:text-2xl font-bold" data-testid="text-publishing-title">
              Publishing
            </h1>
          </div>
          <Button
            size="sm"
            className="gap-2 min-h-[44px] min-w-[44px]"
            onClick={() => startPublishing.mutate()}
            disabled={isPublishing}
            data-testid="button-publish"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Publishing...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span className="hidden sm:inline">Publish</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Publishing Status Card */}
        {isPublishing && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                Publishing
                <Button 
                  variant="outline" 
                  size="sm"
                  className="ml-auto text-xs sm:text-sm"
                  data-testid="button-cancel-publish"
                >
                  Cancel
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={publishingProgress} className="h-2" />
              
              {/* Publishing Steps */}
              <div className="space-y-2">
                {checks.map((check, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 sm:p-3 rounded bg-muted/30"
                    data-testid={`check-${index}`}
                  >
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium">{check.name}</p>
                      {check.message && (
                        <p className="text-xs text-muted-foreground mt-0.5">{check.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs - Mobile Optimized */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full grid grid-cols-4 h-auto sm:w-auto sm:inline-flex" data-testid="tabs-publishing">
            <TabsTrigger value="overview" className="text-xs sm:text-sm py-2 sm:py-2.5 gap-1 sm:gap-2" data-testid="tab-overview">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs sm:text-sm py-2 sm:py-2.5 gap-1 sm:gap-2" data-testid="tab-logs">
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Logs</span>
            </TabsTrigger>
            <TabsTrigger value="domains" className="text-xs sm:text-sm py-2 sm:py-2.5 gap-1 sm:gap-2" data-testid="tab-domains">
              <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Domains</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm py-2 sm:py-2.5 gap-1 sm:gap-2" data-testid="tab-analytics">
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Database Checks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Database className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Database Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {checks.map((check, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded bg-muted/20"
                    data-testid={`database-check-${index}`}
                  >
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium">{check.name}</p>
                      {check.message && (
                        <p className="text-xs text-muted-foreground mt-1">{check.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Current Deployment */}
            {activeDeployment ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base sm:text-lg">Active Deployment</CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        https://{activeDeployment.subdomain}.archetype.app
                      </p>
                    </div>
                    <Badge variant="default" className="bg-green-500">
                      Live
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="text-sm sm:text-base font-medium capitalize">{activeDeployment.status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Visits</p>
                      <p className="text-sm sm:text-base font-medium">{activeDeployment.monthlyVisits.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex flex-col xs:flex-row gap-2">
                    <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm" data-testid="button-visit-site">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Visit Site
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-xs sm:text-sm"
                      onClick={() => pauseDeployment.mutate()}
                      data-testid="button-pause-deployment"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      Pause
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Globe className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                  <h3 className="text-base sm:text-lg font-semibold mb-2">No Active Deployment</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                    Publish your app to make it live
                  </p>
                  <Button onClick={() => startPublishing.mutate()} disabled={isPublishing} data-testid="button-publish-now">
                    <Play className="w-4 h-4 mr-2" />
                    Publish Now
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Deployment Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 sm:h-96">
                  <div className="space-y-1 font-mono text-xs">
                    <div className="text-muted-foreground">[{new Date().toISOString()}] Starting deployment...</div>
                    <div className="text-green-500">[{new Date().toISOString()}] ✓ Database connected</div>
                    <div className="text-green-500">[{new Date().toISOString()}] ✓ Migrations applied</div>
                    <div className="text-green-500">[{new Date().toISOString()}] ✓ Build successful</div>
                    <div className="text-green-500">[{new Date().toISOString()}] ✓ Deployment complete</div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Domains Tab */}
          <TabsContent value="domains">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Custom Domains</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                  Add a custom domain to your deployment (Business plan required)
                </p>
                <Button variant="outline" size="sm" disabled data-testid="button-add-domain">
                  <Globe className="w-4 h-4 mr-2" />
                  Add Domain
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Deployment Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 rounded bg-muted/20">
                    <p className="text-xs text-muted-foreground">Total Visits</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1">{activeDeployment?.monthlyVisits.toLocaleString() || "0"}</p>
                  </div>
                  <div className="p-3 sm:p-4 rounded bg-muted/20">
                    <p className="text-xs text-muted-foreground">Uptime</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1">99.9%</p>
                  </div>
                  <div className="p-3 sm:p-4 rounded bg-muted/20">
                    <p className="text-xs text-muted-foreground">Avg Response Time</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1">120ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
