import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  incidentCount: number;
  activeJobs: number;
  lastChecked: string;
}

export function PlatformHealthIndicator() {
  const { data: health, isLoading } = useQuery<HealthStatus>({
    queryKey: ['/api/platform-health'],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false,
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
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs',
      config.bg
    )}>
      <Icon className={cn('w-4 h-4', config.color)} />
      <span className="font-medium">{config.label}</span>
      
      {health.incidentCount > 0 && (
        <Badge variant="destructive" className="ml-2 h-5">
          {health.incidentCount} incident{health.incidentCount !== 1 ? 's' : ''}
        </Badge>
      )}
      
      {health.activeJobs > 0 && (
        <Badge variant="secondary" className="ml-1 h-5">
          <Zap className="w-3 h-3 mr-1" />
          {health.activeJobs} job{health.activeJobs !== 1 ? 's' : ''}
        </Badge>
      )}

      <span className="ml-auto text-muted-foreground opacity-60 text-xs">
        {new Date(health.lastChecked).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}
      </span>
    </div>
  );
}
