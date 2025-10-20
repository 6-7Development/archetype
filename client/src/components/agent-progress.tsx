import { useState } from "react";
import { Brain, CheckCircle2, AlertTriangle, FileCode, ChevronDown, ChevronRight, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ProgressStep {
  id: string;
  type: "thinking" | "action" | "success" | "error" | "warning";
  message: string;
  details?: string;
  collapsible?: boolean;
}

interface AgentProgressProps {
  steps: ProgressStep[];
  isWorking?: boolean;
  onStop?: () => void;
  showTeachingEmojis?: boolean; // For SySop teaching context only
}

export function AgentProgress({ steps, isWorking, onStop, showTeachingEmojis = false }: AgentProgressProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getIcon = (type: ProgressStep["type"]) => {
    // Use teaching emojis for SySop, Lucide icons for everything else
    if (showTeachingEmojis) {
      switch (type) {
        case "thinking":
          return <span className="text-base">🧠</span>;
        case "action":
          return <span className="text-base">🔨</span>;
        case "success":
          return <span className="text-base">✅</span>;
        case "error":
          return <span className="text-base">❌</span>;
        case "warning":
          return <span className="text-base">⚠️</span>;
        default:
          return <span className="text-base">🧠</span>;
      }
    }
    
    // Default Lucide icons for non-teaching contexts
    switch (type) {
      case "thinking":
        return <Brain className="w-4 h-4 text-muted-foreground" />;
      case "action":
        return <FileCode className="w-4 h-4 text-blue-500" />;
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Brain className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-1" data-testid="agent-progress">
      {steps.map((step, index) => {
        const isExpanded = expandedSteps.has(step.id);
        const isLast = index === steps.length - 1;

        return (
          <div
            key={step.id}
            className={cn(
              "group transition-all duration-200",
              step.collapsible && "cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
            )}
            onClick={() => step.collapsible && toggleStep(step.id)}
            data-testid={`progress-step-${step.id}`}
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">{getIcon(step.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{step.message}</p>
              </div>
              {step.collapsible && (
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>

            {/* Details - shown when expanded */}
            {isExpanded && step.details && (
              <div className="mt-2 ml-7 text-xs text-muted-foreground bg-background/50 rounded p-2 border border-border/50">
                {step.details}
              </div>
            )}
          </div>
        );
      })}

      {/* Working status with Stop button */}
      {isWorking && (
        <div className="flex items-center justify-between pt-2 border-t border-border/50 mt-2">
          <span className="text-sm text-muted-foreground">Building your project...</span>
          {onStop && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onStop}
              className="h-7 px-3"
              data-testid="button-stop-generation"
            >
              <Square className="w-3 h-3 mr-1.5" />
              Stop
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
