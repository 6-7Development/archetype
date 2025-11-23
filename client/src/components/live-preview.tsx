import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Maximize2, Eye, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useWebSocketStream, addWebSocketListener, sendWebSocketMessage } from "@/hooks/use-websocket-stream";

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
  
  // Debounce timeout ref (300ms delay to batch rapid file changes)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use global WebSocket singleton (just need connection status)
  const streamState = useWebSocketStream('live-preview-session', 'anonymous');
  const { isConnected } = streamState;

  // 📡 LIVE PREVIEW: Listen for file-change events from backend
  useEffect(() => {
    if (!projectId) return;

    // Add custom listener for file-change events
    const removeListener = addWebSocketListener((message) => {
      // Listen for new file-change events (P1-1 Backend)
      if (message.type === 'file-change' && message.projectId === projectId) {
        console.log('[LIVE-PREVIEW] 📡 File changed:', message.files);
        
        // Debounce iframe reload (300ms delay to batch rapid changes)
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        
        debounceTimerRef.current = setTimeout(() => {
          console.log('[LIVE-PREVIEW] 🔄 Reloading preview after debounce');
          setPreviewStatus('loading');
          setLastUpdate(message.files?.[0] || 'files');
          setIframeKey(prev => prev + 1);
          
          // Clear update notification after 3s
          setTimeout(() => setLastUpdate(null), 3000);
        }, 300);
      }
    });

    // Cleanup: Remove listener and clear debounce timer
    return () => {
      removeListener();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [projectId]);

  // Subscribe to project when projectId or connection changes
  useEffect(() => {
    if (!projectId || !isConnected) return;
    
    // Send subscription message to backend
    console.log('[LIVE-PREVIEW] 📡 Subscribing to project:', projectId);
    sendWebSocketMessage({
      type: 'subscribe',
      projectId: projectId
    });
    
    // Cleanup: Unsubscribe on unmount or project change
    return () => {
      console.log('[LIVE-PREVIEW] 🔕 Unsubscribing from project:', projectId);
      sendWebSocketMessage({
        type: 'unsubscribe',
        projectId: projectId
      });
    };
  }, [projectId, isConnected]);

  // Auto-refresh when projectId changes
  useEffect(() => {
    if (projectId) {
      setPreviewStatus('loading');
      setErrorMessage(null);
      setIframeKey(prev => prev + 1);
    }
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
            <Badge variant="outline" className="text-xs border-blue-500/20 text-blue-600 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Compiling...
            </Badge>
          )}
          
          {previewStatus === 'ready' && (
            <Badge variant="outline" className="text-xs border-green-500/20 text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Ready
            </Badge>
          )}
          
          {previewStatus === 'error' && (
            <Badge variant="outline" className="text-xs border-red-500/20 text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
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
            className="w-full h-full border-0 bg-white
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
