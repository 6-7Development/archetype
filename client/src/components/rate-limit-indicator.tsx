import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface RateLimitStatus {
  remaining: number;
  limit: number;
  resetAt: string;
  isThrottled: boolean;
  queuePosition?: number;
  estimatedWaitMs?: number;
}

interface RateLimitIndicatorProps {
  status?: RateLimitStatus;
  isLoading?: boolean;
}

export function RateLimitIndicator({ 
  status,
  isLoading = false
}: RateLimitIndicatorProps) {
  if (!status) return null;

  const percentageUsed = ((status.limit - status.remaining) / status.limit) * 100;
  const isWarning = percentageUsed > 70;
  const isCritical = percentageUsed > 90;
  const isThrottled = status.isThrottled || status.remaining < 5;

  const getStatusIcon = () => {
    if (isThrottled) return <Clock className="h-4 w-4 animate-spin" />;
    if (isCritical) return <AlertCircle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const getStatusColor = () => {
    if (isThrottled) return 'text-yellow-600 dark:text-yellow-400';
    if (isCritical) return 'text-red-600 dark:text-red-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const getStatusText = () => {
    if (isThrottled) return 'Rate Limited';
    if (isCritical) return 'Critical';
    if (isWarning) return 'Warning';
    return 'OK';
  };

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.ceil(seconds / 60)}m`;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 hover:bg-background/75 transition-colors cursor-pointer ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-xs font-semibold hidden sm:inline">
            {getStatusText()}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent align="end" className="w-72">
        <div className="space-y-3">
          <div className="font-semibold text-sm">API Rate Limit</div>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Requests Remaining:</span>
              <span className="font-mono font-semibold">{status.remaining} / {status.limit}</span>
            </div>
            <div className="w-full h-2 bg-background rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${isThrottled ? 'bg-yellow-500 animate-pulse' : isCritical ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(percentageUsed, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Used: {percentageUsed.toFixed(1)}%</span>
            </div>
          </div>

          {isThrottled && status.estimatedWaitMs && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-2 space-y-1">
              <div className="font-semibold text-yellow-700 dark:text-yellow-400 text-xs">
                🔄 Rate Limited - Waiting to Retry
              </div>
              {status.queuePosition && (
                <div className="text-xs text-muted-foreground">
                  Queue Position: {status.queuePosition}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Estimated Wait: {formatTime(status.estimatedWaitMs)}
              </div>
            </div>
          )}

          {isCritical && !isThrottled && (
            <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
              <div className="font-semibold text-red-700 dark:text-red-400 text-xs">
                ⚠️ Approaching Rate Limit
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Consider waiting before next request
              </div>
            </div>
          )}

          {!isThrottled && isWarning && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded p-2">
              <div className="font-semibold text-orange-700 dark:text-orange-400 text-xs">
                ⚠️ High Usage
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Resets at: {new Date(status.resetAt).toLocaleTimeString()}
              </div>
            </div>
          )}

          {!isThrottled && !isWarning && (
            <div className="text-xs text-muted-foreground">
              Resets at: {new Date(status.resetAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
