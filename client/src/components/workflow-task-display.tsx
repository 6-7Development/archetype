/**
 * WorkflowTaskDisplay - Unified container for all agent workflow tasks
 * Replaces scattered StatusStrip, RunProgressTable, and AgentProgress
 */

import { TaskBox, type TaskBoxSection } from "@/components/task-box";
import type { ProgressStep, ProgressMetrics } from "@/components/agent-progress";
import type { RunState } from "@shared/agentEvents";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowTaskDisplayProps {
  phase?: string;
  currentMessage?: string;
  steps?: ProgressStep[];
  metrics?: ProgressMetrics;
  isGenerating?: boolean;
  runState?: RunState;
  isCompact?: boolean; // Mobile mode
  className?: string;
}

/**
 * Convert ProgressStep to TaskBoxSection for display
 */
function progressStepToSection(step: ProgressStep, index: number): TaskBoxSection {
  return {
    id: step.id,
    title: step.message,
    content: step.details || "No additional details",
    type: step.type as any,
    duration: step.progress ? Math.floor(step.progress * 100) : undefined,
  };
}

/**
 * Get status for TaskBox from progress step type
 */
function getStatusFromStepType(type: string): "pending" | "in_progress" | "completed" | "error" {
  switch (type) {
    case "success":
      return "completed";
    case "error":
      return "error";
    case "thinking":
    case "action":
      return "in_progress";
    default:
      return "pending";
  }
}

export function WorkflowTaskDisplay({
  phase = "Idle",
  currentMessage = "Ready to assist",
  steps = [],
  metrics,
  isGenerating = false,
  runState,
  isCompact = false,
  className,
}: WorkflowTaskDisplayProps) {
  const completedSteps = steps.filter(s => s.type === "success").length;
  const totalSteps = steps.length;

  // If we have runState (from workflow/SWARM), display those tasks instead
  if (runState && runState.tasks.length > 0) {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Phase Header */}
        <Card className="bg-card/50 border-border/50 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 text-[hsl(50,98%,58%)] animate-spin" />
            <h3 className="font-semibold text-base">
              {runState.phase.charAt(0).toUpperCase() + runState.phase.slice(1)}
            </h3>
            <Badge variant="outline" className="ml-auto text-xs">
              {runState.metrics.completedTasks}/{runState.metrics.totalTasks}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">{runState.phase.replace(/_/g, " ")}</p>
        </Card>

        {/* Individual Tasks */}
        {runState.tasks.map((task, idx) => (
          <TaskBox
            key={task.id}
            taskTitle={task.title || `Task ${idx + 1}`}
            description={task.description || ""}
            status={
              task.status === "done"
                ? "completed"
                : task.status === "blocked"
                  ? "error"
                  : task.status === "in_progress"
                    ? "in_progress"
                    : "pending"
            }
            stepNumber={idx + 1}
            totalSteps={runState.tasks.length}
            sections={task.output ? [{
              id: "output",
              title: "Output",
              content: task.output,
              type: "info",
            }] : []}
            isCompact={isCompact}
          />
        ))}
      </div>
    );
  }

  // If we have progress steps, display as workflow
  if (steps.length > 0) {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Phase Header */}
        <Card className="bg-card/50 border-border/50 p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h3 className="font-semibold text-base">{phase}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">{currentMessage}</p>
            </div>
            <Badge variant="secondary" className="flex-shrink-0 text-xs">
              {completedSteps}/{totalSteps}
            </Badge>
          </div>

          {/* Progress Bar */}
          {totalSteps > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[hsl(50,98%,58%)] to-[hsl(145,60%,45%)] transition-all duration-300"
                  style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {Math.round((completedSteps / totalSteps) * 100)}%
              </span>
            </div>
          )}

          {/* Metrics */}
          {metrics && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {metrics.filesCreated !== undefined && (
                <span>📄 {metrics.filesCreated} created</span>
              )}
              {metrics.filesModified !== undefined && (
                <span>✏️ {metrics.filesModified} modified</span>
              )}
              {metrics.timeElapsed && (
                <span>⏱️ {metrics.timeElapsed}</span>
              )}
              {metrics.estimatedCost !== undefined && (
                <span>💰 ${metrics.estimatedCost.toFixed(2)}</span>
              )}
            </div>
          )}
        </Card>

        {/* Individual Steps */}
        {steps.map((step, idx) => (
          <TaskBox
            key={step.id}
            taskTitle={step.message}
            description={step.details || ""}
            status={getStatusFromStepType(step.type)}
            stepNumber={idx + 1}
            totalSteps={totalSteps}
            sections={step.details ? [{
              id: `detail-${idx}`,
              title: "Details",
              content: step.details,
              type: "info",
            }] : []}
            isCompact={isCompact}
          />
        ))}
      </div>
    );
  }

  // Empty state: just show phase
  return (
    <Card className="bg-card/50 border-border/50 p-4">
      <div className="flex items-center gap-3">
        {isGenerating && (
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
        )}
        <div>
          <h3 className="font-semibold text-sm sm:text-base">{phase}</h3>
          <p className="text-xs text-muted-foreground">{currentMessage}</p>
        </div>
      </div>
    </Card>
  );
}
