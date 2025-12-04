import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, ChevronRight, Square, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface ProgressStep {
  id: string;
  type: "thinking" | "action" | "success" | "error" | "warning";
  message: string;
  details?: string;
  collapsible?: boolean;
  progress?: number; // 0-100 for in-progress tasks
}

export interface ProgressMetrics {
  filesCreated?: number;
  filesModified?: number;
  linesAdded?: number;
  linesRemoved?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  timeElapsed?: string; // e.g., "2m 34s"
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastStepRef = useRef<HTMLDivElement>(null);

  // Calculate completed tasks
  const completedCount = steps.filter(s => s.type === "success").length;
  const totalCount = steps.length;

  // ✅ FIX: Auto-scroll to latest step when steps change
  useEffect(() => {
    if (lastStepRef.current && isOpen) {
      lastStepRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [steps.length, completedCount, isOpen]);

  // Determine if task is completed
  const isCompleted = (step: ProgressStep) => step.type === "success";
  const isInProgress = (step: ProgressStep, index: number) => {
    return index === completedCount && step.type !== "success" && step.type !== "error";
  };

  // Calculate total files changed
  const totalFilesChanged = (metrics?.filesCreated || 0) + (metrics?.filesModified || 0);

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
              {!isOpen && completedCount < totalCount && (
                <span className="text-xs text-muted-foreground">
                  ({Math.round((completedCount / totalCount) * 100)}%)
                </span>
              )}
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
          <div ref={scrollContainerRef} className="border-t border-border/50 px-3 py-2 space-y-2 max-h-64 overflow-y-auto">
            {steps.map((step, index) => {
              const completed = isCompleted(step);
              const inProgress = isInProgress(step, index);
              const hasError = step.type === "error";
              const progress = step.progress || 0;
              const isLastStep = index === steps.length - 1;

              return (
                <div
                  key={step.id}
                  ref={isLastStep ? lastStepRef : null}
                  className="space-y-1.5"
                  data-testid={`progress-step-${step.id}`}
                >
                  <div className="flex items-start gap-2.5 py-0.5">
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

                    {/* Task message and percentage */}
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
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
                      
                      {/* Percentage indicator */}
                      {(inProgress || completed) && (
                        <span className={cn(
                          "text-xs font-medium flex-shrink-0",
                          completed ? "text-primary" : "text-muted-foreground"
                        )}>
                          {completed ? "100%" : `${progress}%`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar - only show when in-progress */}
                  {inProgress && progress > 0 && (
                    <div className="ml-6 mr-2">
                      <Progress 
                        value={progress} 
                        className="h-1.5 transition-all duration-500 ease-out"
                        data-testid={`progress-bar-${step.id}`}
                      />
                    </div>
                  )}
                  
                  {/* Details */}
                  {step.details && (
                    <div className="ml-6">
                      <p className="text-xs text-muted-foreground">
                        {step.details}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Completion Summary - only show when all tasks are complete */}
          {!isWorking && completedCount === totalCount && totalCount > 0 && metrics && (
            <div className="border-t border-border/50 px-3 py-2.5 bg-muted/20">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Check className="w-3.5 h-3.5 text-primary" />
                  <span>Completion Summary</span>
                </div>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {/* Files Changed */}
                  {totalFilesChanged > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Files Changed:</span>
                      <span className="font-medium text-foreground">
                        {totalFilesChanged}
                        {metrics.filesCreated && metrics.filesCreated > 0 && (
                          <span className="text-green-600 ml-1">
                            (+{metrics.filesCreated})
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Lines Changed */}
                  {((metrics.linesAdded || 0) + (metrics.linesRemoved || 0) > 0) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lines Changed:</span>
                      <span className="font-medium">
                        <span className="text-green-600">+{metrics.linesAdded || 0}</span>
                        {" / "}
                        <span className="text-red-600">-{metrics.linesRemoved || 0}</span>
                      </span>
                    </div>
                  )}

                  {/* Tokens Used */}
                  {((metrics.inputTokens || 0) + (metrics.outputTokens || 0) > 0) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tokens Used:</span>
                      <span className="font-medium text-foreground">
                        {((metrics.inputTokens || 0) + (metrics.outputTokens || 0)).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Estimated Cost */}
                  {metrics.estimatedCost && metrics.estimatedCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated Cost:</span>
                      <span className="font-medium text-foreground">
                        ${metrics.estimatedCost.toFixed(4)}
                      </span>
                    </div>
                  )}

                  {/* Time Elapsed */}
                  {metrics.timeElapsed && (
                    <div className="flex justify-between col-span-2">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Time Elapsed:
                      </span>
                      <span className="font-medium text-foreground">
                        {metrics.timeElapsed}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* In-Progress Metrics footer - show during build */}
          {metrics && isWorking && (
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
                    <span className="text-green-600">+{metrics.linesAdded || 0}</span>
                    {" / "}
                    <span className="text-red-600">-{metrics.linesRemoved || 0}</span>
                    {" lines"}
                  </div>
                )}
                {metrics.timeElapsed && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {metrics.timeElapsed}
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
