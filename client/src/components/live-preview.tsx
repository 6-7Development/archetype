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
