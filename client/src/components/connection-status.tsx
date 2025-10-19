import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  onReconnect?: () => void;
}

export function ConnectionStatus({
  isConnected,
  isReconnecting,
  reconnectAttempt,
  onReconnect,
}: ConnectionStatusProps) {
  // Don't show anything if connected
  if (isConnected && !isReconnecting) {
    return null;
  }

  // Show reconnecting state
  if (isReconnecting) {
    return (
      <Alert className="border-yellow-500/50 bg-yellow-500/10" data-testid="alert-reconnecting">
        <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-sm">
            Reconnecting to server... (attempt {reconnectAttempt}/5)
          </span>
          {onReconnect && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReconnect}
              className="h-7 text-xs"
              data-testid="button-force-reconnect"
            >
              Retry Now
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Show disconnected state
  return (
    <Alert className="border-red-500/50 bg-red-500/10" data-testid="alert-disconnected">
      <WifiOff className="h-4 w-4 text-red-500" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-sm">
          Connection lost. Real-time updates unavailable.
        </span>
        {onReconnect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReconnect}
            className="h-7 text-xs hover-elevate active-elevate-2"
            data-testid="button-reconnect"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Reconnect
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface ConnectionIndicatorProps {
  isConnected: boolean;
  isReconnecting: boolean;
  className?: string;
}

export function ConnectionIndicator({
  isConnected,
  isReconnecting,
  className,
}: ConnectionIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="connection-indicator">
      <div className="relative">
        {isConnected && !isReconnecting && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Live</span>
          </div>
        )}
        {isReconnecting && (
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 text-yellow-500 animate-spin" />
            <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Reconnecting...</span>
          </div>
        )}
        {!isConnected && !isReconnecting && (
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-3 h-3 text-red-500" />
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">Offline</span>
          </div>
        )}
      </div>
    </div>
  );
}
