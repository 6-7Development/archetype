import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, AlertCircle, Zap, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { API_ENDPOINTS, getQueryKey } from "@/lib/api-utils";
import { APP_CONFIG } from "@/config/app.config";
import { ROUTES } from "@/config/constants";

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  incidentCount: number;
  activeJobs: number;
  lastChecked: string;
}

export function PlatformHealthIndicator() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: health, isLoading } = useQuery<HealthStatus>({
    queryKey: getQueryKey(API_ENDPOINTS.PLATFORM_HEALTH),
    refetchInterval: APP_CONFIG.limits.sessionTimeout,
    retry: false,
  });

  const handleHealClick = () => {
    toast({ title: "Opening healing console...", description: "LomuAI is ready to analyze platform health" });
    setLocation(ROUTES.PLATFORM_HEALING);
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
        >
          <Zap className="w-3 h-3" />
          Heal
        </Button>
      )}
    </div>
  );
}
