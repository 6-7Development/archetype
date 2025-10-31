import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Eye
} from "lucide-react";

/**
 * Live Platform Preview
 * Shows the running Lomu platform in an iframe
 * Updates in real-time as LomuAI makes changes
 */

interface PlatformPreviewProps {
  showHealing?: boolean;
}

export function PlatformPreview({ showHealing = false }: PlatformPreviewProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [platformStatus, setPlatformStatus] = useState<'running' | 'error' | 'healing'>('running');
  const [lastError, setLastError] = useState<string | null>(null);

  // Get the current app URL
  const appUrl = window.location.origin;

  // Listen for error events from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'platform-error') {
        setLastError(event.data.message);
        setPlatformStatus('error');
        
        if (showHealing) {
          setPlatformStatus('healing');
          // Trigger auto-healing
          fetch('/api/platform/auto-heal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              error: event.data.message,
              stack: event.data.stack 
            }),
          }).catch(console.error);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [showHealing]);

  // Auto-refresh on file changes (in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const handleBeforeUnload = () => {
        setIsRefreshing(true);
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIframeKey(prev => prev + 1);
    setTimeout(() => {
      setIsRefreshing(false);
      setPlatformStatus('running');
    }, 1000);
  };

  const openInNewTab = () => {
    window.open(appUrl, '_blank');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Preview Controls */}
      <div className="h-14 border-b px-4 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Live Platform Preview</span>
          
          {platformStatus === 'running' && (
            <Badge variant="outline" className="text-xs border-green-500/20 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Running
            </Badge>
          )}
          
          {platformStatus === 'error' && (
            <Badge variant="outline" className="text-xs border-red-500/20 text-red-600 dark:text-red-400">
              <AlertCircle className="w-3 h-3 mr-1" />
              Error
            </Badge>
          )}
          
          {platformStatus === 'healing' && (
            <Badge variant="outline" className="text-xs border-yellow-500/20 text-yellow-600 dark:text-yellow-400">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Auto-Healing...
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh-platform"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={openInNewTab}
            data-testid="button-open-platform-new-tab"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {lastError && platformStatus === 'error' && (
        <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Platform Error Detected</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                {lastError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Healing Status */}
      {platformStatus === 'healing' && (
        <div className="mx-4 mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <Loader2 className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0 animate-spin" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                LomuAI is fixing the issue...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The platform will reload automatically when the fix is complete
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Frame */}
      <div className="flex-1 p-4 overflow-hidden">
        <Card className="h-full overflow-hidden border-primary/10">
          <iframe
            key={iframeKey}
            src={appUrl}
            className="w-full h-full border-0 bg-white dark:bg-gray-900"
            sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups allow-top-navigation"
            title="Live Platform Preview"
            data-testid="iframe-platform-preview"
            onLoad={() => {
              setIsRefreshing(false);
              if (platformStatus === 'healing') {
                setPlatformStatus('running');
              }
            }}
          />
        </Card>
      </div>
    </div>
  );
}
