import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink, X, Clock, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { DeploymentStep, DeploymentStepStatus } from "@shared/agentEvents";

interface DeploymentStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deploymentId: string;
  commitHash: string;
  commitMessage: string;
  commitUrl: string;
  timestamp: string;
  platform: "github" | "railway" | "replit";
  steps: DeploymentStep[];
  status: "in_progress" | "successful" | "failed";
  deploymentUrl?: string;
  errorMessage?: string;
}

function getStepIcon(status: DeploymentStepStatus) {
  switch (status) {
    case "complete":
      return <Check className="w-4 h-4 text-emerald-500" data-testid="icon-step-complete" />;
    case "in_progress":
      return <Clock className="w-4 h-4 text-blue-500 animate-pulse" data-testid="icon-step-in-progress" />;
    case "failed":
      return <X className="w-4 h-4 text-destructive" data-testid="icon-step-failed" />;
    default:
      return <div className="w-4 h-4 rounded-full border-2 border-muted" data-testid="icon-step-pending" />;
  }
}

function formatDuration(ms?: number): string {
  if (!ms) return "";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `00:${String(seconds).padStart(2, '0')}`;
}

export function DeploymentStatusModal({
  open,
  onOpenChange,
  commitHash,
  commitMessage,
  commitUrl,
  timestamp,
  platform,
  steps,
  status,
  deploymentUrl,
  errorMessage,
}: DeploymentStatusModalProps) {
  const timeAgo = formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  
  const platformColors = {
    github: "bg-background292e] text-white",
    railway: "bg-[#0B0D0E] text-white",
    replit: "bg-[#F26207] text-white",
  };
  
  const statusColors = {
    in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    successful: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl bg-background/95 backdrop-blur-sm border"
        data-testid="modal-deployment-status"
      >
        <DialogHeader className="border-b pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className={`px-2 py-0.5 rounded text-xs font-medium ${platformColors[platform]}`}>
                  {platform.toUpperCase()}
                </div>
                <Badge 
                  variant="outline" 
                  className={`${statusColors[status]} font-semibold`}
                  data-testid="badge-deployment-status"
                >
                  {status === "in_progress" ? "ACTIVE" : status.toUpperCase()}
                </Badge>
              </div>
              
              <DialogTitle className="text-base font-medium text-foreground mb-1" data-testid="text-commit-message">
                [HexadAI] {commitMessage}
              </DialogTitle>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span data-testid="text-time-ago">{timeAgo}</span>
                <span>•</span>
                <span className="font-mono text-xs" data-testid="text-commit-hash">
                  {commitHash.substring(0, 7)}
                </span>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(commitUrl, '_blank')}
              className="shrink-0"
              data-testid="button-view-commit"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Deployment Steps */}
        <div className="space-y-3 py-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 px-3 rounded-md transition-colors hover-elevate"
              data-testid={`step-${step.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="flex items-center gap-3">
                {getStepIcon(step.status)}
                <span className={`font-medium ${
                  step.status === "complete" 
                    ? "text-foreground" 
                    : step.status === "failed"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}>
                  {step.name}
                </span>
              </div>
              
              {step.durationMs !== undefined && (
                <span className="text-xs text-muted-foreground font-mono" data-testid={`duration-${step.name.toLowerCase().replace(/\s+/g, '-')}`}>
                  ({formatDuration(step.durationMs)})
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Deployment Failed</p>
              <p className="text-xs text-destructive/80 mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Deployment URL */}
        {deploymentUrl && status === "successful" && (
          <div className="pt-4 border-t">
            <Button
              onClick={() => window.open(deploymentUrl, '_blank')}
              className="w-full"
              data-testid="button-view-deployment"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Live Deployment
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
