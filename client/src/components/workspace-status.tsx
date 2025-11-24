import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, Zap, AlertCircle, CheckCircle } from "lucide-react";

interface WorkspaceStatusProps {
  projectName: string;
  status?: 'ready' | 'building' | 'error' | 'deployed';
  filesChanged?: number;
  branch?: string;
  onViewFiles?: () => void;
  onDeploy?: () => void;
}

export function WorkspaceStatus({
  projectName,
  status = 'ready',
  filesChanged = 0,
  branch = 'main',
  onViewFiles,
  onDeploy,
}: WorkspaceStatusProps) {
  const statusConfig = {
    ready: { icon: CheckCircle, color: 'text-green-600', label: 'Ready' },
    building: { icon: Zap, color: 'text-blue-600', label: 'Building...' },
    error: { icon: AlertCircle, color: 'text-red-600', label: 'Error' },
    deployed: { icon: CheckCircle, color: 'text-emerald-600', label: 'Live' },
  };

  const StatusIcon = statusConfig[status].icon;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border gap-4 flex-wrap">
      {/* Project Info */}
      <div className="flex items-center gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{projectName}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <GitBranch className="w-3 h-3" />
            <span>{branch}</span>
          </div>
        </div>
      </div>

      {/* Status & Files */}
      <div className="flex items-center gap-3">
        {filesChanged > 0 && (
          <Badge variant="secondary" className="gap-1">
            <span>{filesChanged}</span>
            <span className="hidden sm:inline">files changed</span>
          </Badge>
        )}

        {/* Status Badge */}
        <Badge variant="outline" className={`gap-1 ${statusConfig[status].color}`}>
          <StatusIcon className="w-3 h-3" />
          <span>{statusConfig[status].label}</span>
        </Badge>

        {/* Action Buttons */}
        {filesChanged > 0 && onViewFiles && (
          <Button
            size="sm"
            variant="outline"
            onClick={onViewFiles}
            data-testid="button-view-files"
          >
            View
          </Button>
        )}

        {status === 'ready' && onDeploy && (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={onDeploy}
            data-testid="button-deploy"
          >
            Deploy
          </Button>
        )}
      </div>
    </div>
  );
}
