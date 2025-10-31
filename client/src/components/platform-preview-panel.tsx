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
  PlayCircle,
  FileCode,
  Sparkles
} from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

interface PreviewManifest {
  sessionId: string;
  buildStatus: 'building' | 'success' | 'failed';
  artifacts: string[];
  errors: string[];
  timestamp: string;
  changedFiles?: string[];
}

interface TestResults {
  passed: number;
  failed: number;
  errors: string[];
}

interface PlatformPreviewPanelProps {
  sessionId: string | null;
  previewUrl?: string;
  testResults?: TestResults | null;
  manifest?: PreviewManifest | null;
  onRefresh?: () => void;
  onDeploy?: () => void;
}

/**
 * Platform Preview Panel
 * Shows sandboxed preview of platform code changes during healing sessions
 */
export function PlatformPreviewPanel({
  sessionId,
  previewUrl,
  testResults,
  manifest,
  onRefresh,
  onDeploy,
}: PlatformPreviewPanelProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [buildStatus, setBuildStatus] = useState<'building' | 'ready' | 'failed' | 'idle'>('idle');

  // Update build status from manifest
  useEffect(() => {
    if (!manifest) {
      setBuildStatus('idle');
      return;
    }

    if (manifest.buildStatus === 'building') {
      setBuildStatus('building');
    } else if (manifest.buildStatus === 'success') {
      setBuildStatus('ready');
      // Force iframe refresh when new build is ready
      setIframeKey(prev => prev + 1);
    } else if (manifest.buildStatus === 'failed') {
      setBuildStatus('failed');
    }
  }, [manifest]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setBuildStatus('building');
    setIframeKey(prev => prev + 1);
    
    if (onRefresh) {
      onRefresh();
    }
    
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleDeploy = () => {
    if (onDeploy && buildStatus === 'ready') {
      onDeploy();
    }
  };

  const openInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  // Check if tests are passing
  const testsArePassing = testResults && testResults.failed === 0;
  const canDeploy = buildStatus === 'ready' && testsArePassing;

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Preview Session</h3>
          <p className="text-sm text-muted-foreground">
            Start a platform healing session to see live preview of changes
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
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Platform Preview</span>
          
          {buildStatus === 'idle' && (
            <Badge variant="outline" className="text-xs border-muted-foreground/20 text-muted-foreground" data-testid="status-idle">
              Idle
            </Badge>
          )}
          
          {buildStatus === 'building' && (
            <Badge variant="outline" className="text-xs border-blue-500/20 text-blue-600 dark:text-blue-400" data-testid="status-building">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Building...
            </Badge>
          )}
          
          {buildStatus === 'ready' && (
            <Badge variant="outline" className="text-xs border-green-500/20 text-green-600 dark:text-green-400" data-testid="status-ready">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Ready
            </Badge>
          )}
          
          {buildStatus === 'failed' && (
            <Badge variant="outline" className="text-xs border-red-500/20 text-red-600 dark:text-red-400" data-testid="status-failed">
              <AlertCircle className="w-3 h-3 mr-1" />
              Build Failed
            </Badge>
          )}

          {/* Test Results Badge */}
          {testResults && (
            <Badge 
              variant="outline" 
              className={`text-xs ${
                testsArePassing 
                  ? 'border-green-500/20 text-green-600 dark:text-green-400' 
                  : 'border-red-500/20 text-red-600 dark:text-red-400'
              }`}
              data-testid="status-tests"
            >
              {testsArePassing ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Tests Passing ({testResults.passed})
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {testResults.failed} Tests Failed
                </>
              )}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh-preview"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={openInNewTab}
            disabled={!previewUrl}
            data-testid="button-open-preview-tab"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="default"
            onClick={handleDeploy}
            disabled={!canDeploy}
            data-testid="button-deploy-changes"
            className="ml-2"
          >
            <PlayCircle className="w-4 h-4 mr-1" />
            Deploy Changes
          </Button>
        </div>
      </div>

      {/* Build Errors */}
      {buildStatus === 'failed' && manifest?.errors && manifest.errors.length > 0 && (
        <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Build Errors</p>
              <div className="mt-2 space-y-1">
                {manifest.errors.map((error, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground font-mono" data-testid={`error-${idx}`}>
                    {error}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Failures */}
      {testResults && !testsArePassing && (
        <div className="mx-4 mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                Smoke Tests Failed
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Deployment is blocked until tests pass
              </p>
              {testResults.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {testResults.errors.map((error, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground font-mono" data-testid={`test-error-${idx}`}>
                      {error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Changed Files Summary */}
      {manifest?.changedFiles && manifest.changedFiles.length > 0 && (
        <div className="mx-4 mt-4 p-3 bg-primary/5 border border-primary/10 rounded-lg">
          <div className="flex items-start gap-2">
            <FileCode className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Changed Files ({manifest.changedFiles.length})</p>
              <div className="mt-2 space-y-1">
                {manifest.changedFiles.slice(0, 5).map((file, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground font-mono truncate" data-testid={`changed-file-${idx}`}>
                    {file}
                  </p>
                ))}
                {manifest.changedFiles.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    ... and {manifest.changedFiles.length - 5} more
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Frame */}
      <div className="flex-1 p-4 overflow-hidden">
        <Card className="h-full overflow-hidden border-primary/10">
          {previewUrl && buildStatus === 'ready' ? (
            <iframe
              key={iframeKey}
              src={previewUrl}
              className="w-full h-full border-0 bg-white dark:bg-gray-900"
              sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
              title="Platform Preview"
              data-testid="iframe-platform-preview"
              onLoad={() => {
                setIsRefreshing(false);
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md p-6">
                {buildStatus === 'building' && (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      Building preview...
                    </p>
                  </>
                )}
                {buildStatus === 'idle' && (
                  <>
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Waiting for changes...
                    </p>
                  </>
                )}
                {buildStatus === 'failed' && (
                  <>
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
                    <p className="text-sm text-muted-foreground">
                      Build failed. Check errors above.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
