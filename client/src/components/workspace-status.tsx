import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, Zap, AlertCircle, CheckCircle, Settings } from "lucide-react";
import { GitStatus } from "@/components/git-status";

interface WorkspaceStatusProps {
  projectName: string;
  status?: 'ready' | 'building' | 'error' | 'deployed';
  filesChanged?: number;
  branch?: string;
  gitStatus?: { ahead?: number; behind?: number; uncommitted?: number };
  onViewFiles?: () => void;
  onDeploy?: () => void;
  onViewEnv?: () => void;
}

export function WorkspaceStatus({
  projectName,
  status = 'ready',
  filesChanged = 0,
  branch = 'main',
  gitStatus,
  onViewFiles,
  onDeploy,
  onViewEnv,
}: WorkspaceStatusProps) {
  const statusConfig = {
    ready: { icon: CheckCircle, color: 'text-green-600', label: 'Ready' },
    building: { icon: Zap, color: 'text-blue-600', label: 'Building...' },
    error: { icon: AlertCircle, color: 'text-red-600', label: 'Error' },
    deployed: { icon: CheckCircle, color: 'text-emerald-600', label: 'Live' },
  };

  const StatusIcon = statusConfig[status].icon;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border gap-3 flex-wrap">
      {/* Project Info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{projectName}</div>
        </div>
      </div>

      {/* Git & Status Info */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Git Status */}
        <GitStatus
          branch={branch}
          ahead={gitStatus?.ahead}
          behind={gitStatus?.behind}
          uncommitted={gitStatus?.uncommitted}
          onViewChanges={onViewFiles}
        />

        {filesChanged > 0 && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <span>{filesChanged}</span>
            <span className="hidden sm:inline">files</span>
          </Badge>
        )}

        {/* Status Badge */}
        <Badge variant="outline" className={`gap-1 ${statusConfig[status].color}`}>
          <StatusIcon className="w-3 h-3" />
          <span className="hidden sm:inline">{statusConfig[status].label}</span>
        </Badge>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {onViewEnv && (
          <Button
            size="sm"
            variant="outline"
            onClick={onViewEnv}
            className="h-6"
            data-testid="button-view-env"
          >
            <Settings className="w-3 h-3" />
            <span className="hidden sm:inline ml-1">Env</span>
          </Button>
        )}

        {status === 'ready' && onDeploy && (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 h-6"
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
