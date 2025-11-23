import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, AlertCircle, Zap, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  incidentCount: number;
  activeJobs: number;
  lastChecked: string;
}

export function PlatformHealthIndicator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: health, isLoading } = useQuery<HealthStatus>({
    queryKey: ['/api/platform-health'],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false,
  });

  const triggerHealingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/healing/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'platform' }),
      });
      if (!response.ok) throw new Error('Failed to trigger healing');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Healing started!", description: "LomuAI is analyzing platform health..." });
      queryClient.invalidateQueries({ queryKey: ['/api/platform-health'] });
      // Navigate to platform healing page
      setLocation('/platform-healing');
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to trigger healing", variant: "destructive" });
    },
  });

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
          onClick={() => triggerHealingMutation.mutate()}
          disabled={triggerHealingMutation.isPending}
          data-testid="button-trigger-healing"
        >
          <Zap className="w-3 h-3" />
          {triggerHealingMutation.isPending ? 'Starting...' : 'Heal'}
        </Button>
      )}
    </div>
  );
}
