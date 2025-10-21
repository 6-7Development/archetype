import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface ProgressStep {
  id: string;
  type: "thinking" | "action" | "success" | "error" | "warning";
  message: string;
  details?: string;
  collapsible?: boolean;
}

export interface ProgressMetrics {
  filesCreated?: number;
  filesModified?: number;
  linesAdded?: number;
  linesRemoved?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
}

interface AgentProgressProps {
  steps: ProgressStep[];
  isWorking?: boolean;
  onStop?: () => void;
  showTeachingEmojis?: boolean;
  metrics?: ProgressMetrics;
}

export function AgentProgress({ steps, isWorking, onStop, showTeachingEmojis = false, metrics }: AgentProgressProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Calculate completed tasks
  const completedCount = steps.filter(s => s.type === "success").length;
  const totalCount = steps.length;

  // Determine if task is completed
  const isCompleted = (step: ProgressStep) => step.type === "success";
  const isInProgress = (step: ProgressStep, index: number) => {
    return index === completedCount && step.type !== "success" && step.type !== "error";
  };

  return (
    <div className="border border-border/50 rounded-md bg-background" data-testid="agent-progress">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header with progress counter */}
        <CollapsibleTrigger className="w-full hover-elevate active-elevate-2" data-testid="progress-toggle">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex items-center gap-2">
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium text-foreground">
                {completedCount} / {totalCount} tasks
              </span>
            </div>
            
            {/* Working indicator */}
            {isWorking && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                <span className="text-xs text-muted-foreground">Working...</span>
              </div>
            )}
          </div>
        </CollapsibleTrigger>

        {/* Collapsible task list */}
        <CollapsibleContent>
          <div className="border-t border-border/50 px-3 py-2 space-y-1">
            {steps.map((step, index) => {
              const completed = isCompleted(step);
              const inProgress = isInProgress(step, index);
              const hasError = step.type === "error";

              return (
                <div
                  key={step.id}
                  className="flex items-start gap-2.5 py-1.5"
                  data-testid={`progress-step-${step.id}`}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0 mt-0.5">
                    {completed ? (
                      <div className="w-4 h-4 rounded-sm bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                      </div>
                    ) : hasError ? (
                      <div className="w-4 h-4 rounded-sm border-2 border-destructive bg-destructive/10" />
                    ) : inProgress ? (
                      <div className="w-4 h-4 rounded-sm border-2 border-primary animate-pulse" />
                    ) : (
                      <div className="w-4 h-4 rounded-sm border-2 border-border" />
                    )}
                  </div>

                  {/* Task message */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm leading-snug",
                        completed && "text-muted-foreground",
                        hasError && "text-destructive",
                        inProgress && "text-foreground font-medium",
                        !completed && !hasError && !inProgress && "text-muted-foreground"
                      )}
                    >
                      {showTeachingEmojis && (
                        <span className="mr-1.5">
                          {step.type === "thinking" && "🧠"}
                          {step.type === "action" && "🔨"}
                          {step.type === "success" && "✅"}
                          {step.type === "error" && "❌"}
                          {step.type === "warning" && "⚠️"}
                        </span>
                      )}
                      {step.message}
                    </p>
                    
                    {/* Details */}
                    {step.details && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {step.details}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Metrics footer - only show after completion (not during build) */}
          {metrics && !isWorking && (
            <div className="border-t border-border/50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {((metrics.inputTokens || 0) + (metrics.outputTokens || 0) > 0) && (
                  <div>
                    {((metrics.inputTokens || 0) + (metrics.outputTokens || 0)).toLocaleString()} tokens
                    {metrics.estimatedCost && metrics.estimatedCost > 0 && (
                      <span className="ml-1">
                        (${metrics.estimatedCost.toFixed(4)})
                      </span>
                    )}
                  </div>
                )}
                {((metrics.linesAdded || 0) + (metrics.linesRemoved || 0) > 0) && (
                  <div>
                    <span className="text-green-600 dark:text-green-400">+{metrics.linesAdded || 0}</span>
                    {" / "}
                    <span className="text-red-600 dark:text-red-400">-{metrics.linesRemoved || 0}</span>
                    {" lines"}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stop button */}
          {isWorking && onStop && (
            <div className="border-t border-border/50 px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onStop();
                }}
                className="h-7 w-full justify-center gap-1.5"
                data-testid="button-stop-generation"
              >
                <Square className="w-3 h-3" />
                Stop
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
