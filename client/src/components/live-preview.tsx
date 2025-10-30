import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Maximize2, Eye, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface LivePreviewProps {
  projectId: string | null;
  fileCount?: number;
}

export function LivePreview({ projectId, fileCount = 0 }: LivePreviewProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Auto-refresh when projectId changes
  useEffect(() => {
    if (projectId) {
      setPreviewStatus('loading');
      setErrorMessage(null);
      setIframeKey(prev => prev + 1);
    }
  }, [projectId]);

  // 📡 LIVE PREVIEW: Listen for Meta-SySop file updates via WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[LIVE-PREVIEW] WebSocket connected for file updates');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Listen for Meta-SySop file updates
            if (data.type === 'platform_file_updated') {
              // Match current project OR platform code
              const currentProject = projectId || 'platform';
              const updateProject = data.projectId || 'platform';
              
              if (currentProject === updateProject) {
                console.log('[LIVE-PREVIEW] 📡 File updated for project:', updateProject, data.path);
                
                // Force iframe reload to show changes
                setPreviewStatus('loading');
                setLastUpdate(data.path);
                setIframeKey(prev => prev + 1);
                
                // Show update notification briefly
                setTimeout(() => {
                  setLastUpdate(null);
                }, 3000);
              } else {
                console.log('[LIVE-PREVIEW] 🔇 Ignoring update for different project:', updateProject);
              }
            }
          } catch (error) {
            console.error('[LIVE-PREVIEW] Failed to parse WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('[LIVE-PREVIEW] WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('[LIVE-PREVIEW] WebSocket disconnected, will reconnect in 3s');
          // Auto-reconnect after 3 seconds
          reconnectTimeout = setTimeout(() => {
            connect();
          }, 3000);
        };
      } catch (error) {
        console.error('[LIVE-PREVIEW] Failed to create WebSocket:', error);
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [projectId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setPreviewStatus('loading');
    setErrorMessage(null);
    setIframeKey(prev => prev + 1);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  const handleIframeLoad = () => {
    setPreviewStatus('ready');
    setIsRefreshing(false);
  };

  const handleIframeError = () => {
    setPreviewStatus('error');
    setErrorMessage('Failed to load preview');
    setIsRefreshing(false);
  };

  const openInNewTab = () => {
    if (projectId) {
      window.open(`/api/preview/${projectId}`, '_blank');
    }
  };

  if (!projectId) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Eye className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Project Selected</h3>
          <p className="text-sm text-muted-foreground">
            Select or create a project to see a live preview
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Preview Controls */}
      <div className="h-14 border-b px-4 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Live Preview</span>
          
          {previewStatus === 'loading' && (
            <Badge variant="outline" className="text-xs border-blue-500/20 text-blue-600 dark:text-blue-400">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Compiling...
            </Badge>
          )}
          
          {previewStatus === 'ready' && (
            <Badge variant="outline" className="text-xs border-green-500/20 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Ready
            </Badge>
          )}
          
          {previewStatus === 'error' && (
            <Badge variant="outline" className="text-xs border-red-500/20 text-red-600 dark:text-red-400">
              <AlertCircle className="w-3 h-3 mr-1" />
              Error
            </Badge>
          )}
          
          {lastUpdate && (
            <Badge variant="outline" className="text-xs border-primary/20 bg-primary/5 animate-pulse">
              📡 {lastUpdate}
            </Badge>
          )}
          
          {fileCount > 0 && (
            <Badge variant="outline" className="text-xs border-primary/20">
              {fileCount} files
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-preview-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={openInNewTab}
            data-testid="button-preview-new-tab"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {previewStatus === 'error' && errorMessage && (
        <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Preview Error</p>
              <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Frame */}
      <div className="flex-1 p-4 overflow-hidden">
        <Card className="h-full overflow-hidden border-primary/10">
          <iframe
            key={iframeKey}
            src={`/api/preview/${projectId}`}
            className="w-full h-full border-0 bg-white dark:bg-gray-900"
            sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups"
            title="Live Preview"
            data-testid="iframe-preview"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </Card>
      </div>
    </div>
  );
}
