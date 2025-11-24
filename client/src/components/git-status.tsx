import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, GitCommit, AlertCircle } from "lucide-react";

interface GitStatusProps {
  branch?: string;
  ahead?: number;
  behind?: number;
  uncommitted?: number;
  onViewChanges?: () => void;
}

export function GitStatus({
  branch = "main",
  ahead = 0,
  behind = 0,
  uncommitted = 0,
  onViewChanges,
}: GitStatusProps) {
  return (
    <div className="flex items-center gap-2" data-testid="git-status">
      {/* Branch */}
      <Badge variant="outline" className="gap-1 text-xs">
        <GitBranch className="w-3 h-3" />
        <span>{branch}</span>
      </Badge>

      {/* Sync Status */}
      {(ahead > 0 || behind > 0) && (
        <Badge variant="secondary" className="gap-1 text-xs">
          {behind > 0 && <span>⬇ {behind}</span>}
          {ahead > 0 && <span>⬆ {ahead}</span>}
        </Badge>
      )}

      {/* Uncommitted Changes */}
      {uncommitted > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1 h-6 text-xs"
          onClick={onViewChanges}
          data-testid="button-view-changes"
        >
          <AlertCircle className="w-3 h-3 text-orange-600" />
          {uncommitted} changes
        </Button>
      )}
    </div>
  );
}
