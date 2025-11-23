import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, AlertCircle, Zap, Activity, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS, getQueryKey, postApi } from "@/lib/api-utils";
import { APP_CONFIG } from "@/config/app.config";
import { HealingProgressModal } from "./healing-progress-modal";

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  incidentCount: number;
  activeJobs: number;
  lastChecked: string;
}

export function PlatformHealthIndicator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showHealingModal, setShowHealingModal] = useState(false);
  const [healingJobId, setHealingJobId] = useState<string | null>(null);
  
  const { data: health, isLoading } = useQuery<HealthStatus>({
    queryKey: getQueryKey(API_ENDPOINTS.PLATFORM_HEALTH),
    refetchInterval: APP_CONFIG.limits.sessionTimeout,
    retry: false,
  });

  // Autonomous healing mutation
  const autoHealMutation = useMutation({
    mutationFn: async () => {
      console.log('[HEAL-BUTTON] Starting autonomous heal request...');
      console.log('[HEAL-BUTTON] API endpoint:', '/api/healing/auto-heal');
      console.log('[HEAL-BUTTON] Full URL:', `${APP_CONFIG.api.baseURL}/api/healing/auto-heal`);
      
      try {
        const result = await postApi("/api/healing/auto-heal", {});
        console.log('[HEAL-BUTTON] Success:', result);
        return result;
      } catch (error) {
        console.error('[HEAL-BUTTON] Error details:', error);
        console.error('[HEAL-BUTTON] Error type:', error?.constructor?.name);
        console.error('[HEAL-BUTTON] Error message:', (error as any)?.message);
        throw error;
      }
    },
    onSuccess: (data: any) => {
      // Open the progress modal to show real-time healing progress
      setShowHealingModal(true);
      setHealingJobId(data.jobId || null);
      
      toast({ 
        title: "🤖 Autonomous Healing Started", 
        description: "Watch LomuAI analyze and fix issues in real-time...",
        duration: 3000,
      });
      
      // Invalidate health query to trigger refetch
      queryClient.invalidateQueries({ queryKey: getQueryKey(API_ENDPOINTS.PLATFORM_HEALTH) });
    },
    onError: (error: any) => {
      toast({ 
        title: "Healing Failed", 
        description: error?.message || "Could not start autonomous healing process",
        variant: "destructive",
      });
    },
  });

  const handleHealClick = () => {
    autoHealMutation.mutate();
  };
  
  const handleCloseModal = () => {
    setShowHealingModal(false);
    setHealingJobId(null);
    // Refetch health status when modal closes
    queryClient.invalidateQueries({ queryKey: getQueryKey(API_ENDPOINTS.PLATFORM_HEALTH) });
  };

  if (isLoading || !health) {
    return (
      <Badge variant="outline" className="text-xs">
        <span className="animate-pulse">Loading...</span>
      </Badge>
    );
  }

  const statusConfig = {
    healthy: {
      icon: CheckCircle2,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
      label: 'Healthy',
    },
    degraded: {
      icon: AlertCircle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
      label: 'Degraded',
    },
    critical: {
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
      label: 'Critical',
    },
  };

  const config = statusConfig[health.status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs',
        config.bg
      )}>
        <Icon className={cn('w-4 h-4', config.color)} />
        <span className="font-medium">{config.label}</span>
        
        {health.incidentCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 h-5 px-1.5 text-xs"
            onClick={() => setLocation('/incidents')}
            data-testid="button-view-incidents"
          >
            <Badge variant="destructive" className="h-5">
              {health.incidentCount}
            </Badge>
          </Button>
        )}
        
        {health.activeJobs > 0 && (
          <Badge variant="secondary" className="ml-1 h-5">
            <Activity className="w-3 h-3 mr-1 animate-pulse" />
            {health.activeJobs}
          </Badge>
        )}

        <span className="ml-auto text-muted-foreground opacity-60 text-xs">
          {new Date(health.lastChecked).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>

      {/* Manual Healing Trigger */}
      {health.incidentCount > 0 && (
        <Button
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={handleHealClick}
          data-testid="button-trigger-healing"
          disabled={autoHealMutation.isPending}
        >
          {autoHealMutation.isPending ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Healing...
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" />
              Heal
            </>
          )}
        </Button>
      )}
      
      {/* Healing Progress Modal */}
      <HealingProgressModal 
        isOpen={showHealingModal}
        onClose={handleCloseModal}
        jobId={healingJobId}
      />
    </div>
  );
}
