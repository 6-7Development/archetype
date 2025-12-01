import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Maximize2, Eye, CheckCircle2, AlertCircle, Loader2, Zap, Code, Wand2, FileCode, TestTube } from "lucide-react";
import { useWebSocketStream, addWebSocketListener, sendWebSocketMessage } from "@/hooks/use-websocket-stream";
import { motion } from "framer-motion";
import { QueenBeeAnimation } from "@/components/queen-bee-animation";

interface LivePreviewProps {
  projectId: string | null;
  fileCount?: number;
  refreshKey?: number;
}

export function LivePreview({ projectId, fileCount = 0, refreshKey = 0 }: LivePreviewProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [previewUrl] = useState<string>('http://localhost:5000');
  
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
    setErrorMessage('Failed to load preview - ensure the app is running on localhost:5000');
    setIsRefreshing(false);
  };

  const openInNewTab = () => {
    window.open(previewUrl, '_blank');
  };

  if (!projectId) {
    return (
      <div className="h-full flex flex-col p-6 bg-gradient-to-br from-amber-50 via-white to-teal-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-auto">
        {/* SWARM Animation Header */}
        <div className="text-center mb-6">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <QueenBeeAnimation isAnimating emotion="thinking" size="lg" />
            {/* SWARM particles around bee */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-amber-400"
                style={{
                  left: '50%',
                  top: '50%',
                }}
                animate={{
                  x: [0, Math.cos(i * 60 * Math.PI / 180) * 40, 0],
                  y: [0, Math.sin(i * 60 * Math.PI / 180) * 40, 0],
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            BeeHive Preview
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
            Start a project or ask Scout to build something to see it here
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-amber-200 dark:border-amber-800/50 shadow-sm"
          >
            <Code className="w-6 h-6 text-amber-600 dark:text-amber-400 mb-2" />
            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Code Generation</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Scout writes production code</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-teal-200 dark:border-teal-800/50 shadow-sm"
          >
            <Zap className="w-6 h-6 text-teal-600 dark:text-teal-400 mb-2" />
            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">SWARM Mode</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Parallel multi-agent execution</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-4 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-purple-200 dark:border-purple-800/50 shadow-sm"
          >
            <Wand2 className="w-6 h-6 text-purple-600 dark:text-purple-400 mb-2" />
            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Auto Healing</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Self-fixing platform</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-4 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-blue-200 dark:border-blue-800/50 shadow-sm"
          >
            <TestTube className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-2" />
            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Browser Testing</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Playwright integration</p>
          </motion.div>
        </div>

        {/* Demo CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          <Badge className="bg-gradient-to-r from-amber-500 to-teal-500 text-white border-0">
            Ask Scout: "Build me a todo app"
          </Badge>
        </motion.div>
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
          
          {projectId && (
            <Badge variant="outline" className="text-xs border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">
              {projectId.slice(0, 8)}...
            </Badge>
          )}
          
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
              <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">BeeHive Preview</div>
              <div className="flex-1 bg-white dark:bg-slate-700 border border-amber-200 dark:border-amber-800/50 rounded px-3 py-2 text-xs text-amber-900 dark:text-amber-200 font-mono">
                {previewUrl}
              </div>
            </div>
            
            {/* Live App Preview */}
            <iframe
              key={iframeKey}
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
