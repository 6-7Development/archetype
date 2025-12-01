import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Maximize2, Eye, CheckCircle2, AlertCircle, Loader2, MonitorPlay, FolderCode } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWebSocketStream, addWebSocketListener, sendWebSocketMessage } from "@/hooks/use-websocket-stream";

interface LivePreviewProps {
  projectId: string | null;
  fileCount?: number;
  refreshKey?: number;
  showLiveApp?: boolean; // When true, show actual running app instead of project preview
}

export function LivePreview({ projectId, fileCount = 0, refreshKey = 0, showLiveApp = true }: LivePreviewProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'app' | 'project'>('app');
  
  // Determine preview URL based on mode:
  // - 'app' mode: Show the actual running BeeHive app (like Replit preview)
  // - 'project' mode: Show compiled project files
  const getPreviewUrl = () => {
    if (previewMode === 'app' || !projectId) {
      // Show the live running app - this is the Replit-style preview
      return `/?preview=true&t=${iframeKey}`;
    }
    // Show project-specific preview (compiled files)
    return `/api/preview/${projectId}?t=${iframeKey}`;
  };
  
  const previewUrl = getPreviewUrl();
  
  // Watch for refreshKey changes and reload preview
  useEffect(() => {
    if (refreshKey > 0) {
      console.log('[LIVE-PREVIEW] 🔄 Refresh triggered by parent');
      setPreviewStatus('loading');
      setIframeKey(prev => prev + 1);
    }
  }, [refreshKey]);
  
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

  // Track previous projectId to detect actual changes
  const prevProjectIdRef = useRef<string | null>(null);
  
  // Auto-refresh when projectId changes - force complete reload with cache busting
  useEffect(() => {
    const prevProjectId = prevProjectIdRef.current;
    prevProjectIdRef.current = projectId;
    
    if (projectId && projectId !== prevProjectId) {
      console.log('[LIVE-PREVIEW] 🔄 Project changed:', prevProjectId, '→', projectId);
      
      // Clear all state for clean slate
      setPreviewStatus('loading');
      setErrorMessage(null);
      setLastUpdate(null);
      
      // Force iframe reload with timestamp for cache busting
      setIframeKey(Date.now());
      
      // Show brief loading indicator
      setTimeout(() => {
        if (previewStatus === 'loading') {
          console.log('[LIVE-PREVIEW] 📡 Waiting for new project preview...');
        }
      }, 1000);
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
    setErrorMessage('Failed to load preview - project may not have valid entry files (index.html, index.tsx, App.tsx)');
    setIsRefreshing(false);
  };

  const openInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  // No longer return placeholder - always show live preview iframe

  return (
    <div className="h-full flex flex-col">
      {/* Preview Controls */}
      <div className="h-14 border-b px-4 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Live Preview</span>
          
          {/* Preview Mode Toggle - Like Replit */}
          <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as 'app' | 'project')} className="ml-2">
            <TabsList className="h-7 p-0.5">
              <TabsTrigger 
                value="app" 
                className="h-6 px-2 text-xs gap-1"
                data-testid="tab-preview-app"
              >
                <MonitorPlay className="w-3 h-3" />
                App
              </TabsTrigger>
              {projectId && (
                <TabsTrigger 
                  value="project" 
                  className="h-6 px-2 text-xs gap-1"
                  data-testid="tab-preview-project"
                >
                  <FolderCode className="w-3 h-3" />
                  Project
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          
          {previewStatus === 'loading' && (
            <Badge variant="outline" className="text-xs border-blue-500/20 text-blue-600 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading...
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
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Preview Error</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Frame */}
      <div className="flex-1 p-4 overflow-hidden">
        <Card className="h-full overflow-hidden border-primary/10 bg-white dark:bg-slate-900">
          <div className="flex flex-col h-full">
            {/* Browser Address Bar Simulation */}
            <div className="border-b bg-amber-50 dark:bg-slate-800 px-4 py-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
              </div>
              <div className="flex-1 bg-white dark:bg-slate-700 border border-amber-200 dark:border-amber-800/50 rounded px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200 font-mono flex items-center gap-2">
                <MonitorPlay className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate">
                  {previewMode === 'app' 
                    ? `${window.location.origin}/` 
                    : `/api/preview/${projectId?.slice(0, 8)}...`}
                </span>
              </div>
              <Badge variant="outline" className="text-xs border-green-500/30 text-green-600 flex-shrink-0">
                {previewMode === 'app' ? 'Live' : 'Sandbox'}
              </Badge>
            </div>
            
            {/* Live App Preview - Always show iframe */}
            <iframe
              key={`${previewMode}-${iframeKey}`}
              src={previewUrl}
              className="flex-1 border-0 bg-white w-full"
              sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups allow-top-navigation"
              title="Live Preview"
              data-testid="iframe-preview"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
