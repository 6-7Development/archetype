import { useState } from "react";
import { 
  Brain, 
  CheckCircle2, 
  AlertTriangle, 
  FileCode, 
  ChevronDown, 
  ChevronRight, 
  Square,
  Clock,
  Zap,
  FileText,
  DollarSign,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface EnhancedProgressStep {
  id: string;
  type: "thinking" | "action" | "success" | "error" | "warning" | "tool";
  message: string;
  emoji?: string;  // Custom emoji for the step
  details?: string;
  collapsible?: boolean;
  fileCount?: number;
  linesChanged?: { added: number; removed: number };
}

export interface WorkMetrics {
  timeElapsed: number;  // milliseconds
  actionsCompleted: number;
  filesCreated: number;
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  tokensUsed?: number;
  cost?: number;
}

interface EnhancedAgentProgressProps {
  steps: EnhancedProgressStep[];
  currentStep?: number;
  totalSteps?: number;
  isWorking?: boolean;
  onStop?: () => void;
  metrics?: WorkMetrics;
  showMetrics?: boolean;
  showTeachingEmojis?: boolean; // For SySop teaching context only
}

export function EnhancedAgentProgress({ 
  steps, 
  currentStep = 0,
  totalSteps = 12,
  isWorking, 
  onStop,
  metrics,
  showMetrics = false
}: EnhancedAgentProgressProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getIcon = (step: EnhancedProgressStep) => {
    // If custom emoji is provided, use that
    if (step.emoji) {
      return <span className="text-base">{step.emoji}</span>;
    }

    switch (step.type) {
      case "thinking":
        return <Brain className="w-4 h-4 text-primary animate-pulse" />;
      case "action":
        return <FileCode className="w-4 h-4 text-blue-500" />;
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "tool":
        return <Zap className="w-4 h-4 text-orange-500" />;
      default:
        return <Brain className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    return `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
  };

  const completedSteps = steps.filter(s => s.type === 'success').length;
  const progressPercentage = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <Card className="bg-muted/30 border-primary/20" data-testid="enhanced-agent-progress">
      {/* Header with collapsible toggle */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover-elevate rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid="progress-header"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="font-semibold text-sm">
              {isWorking ? "🧠 SySop is teaching and building..." : "✅ Task Complete"}
            </span>
          </div>
          
          <Badge variant="outline" className="font-mono text-xs">
            {currentStep} / {totalSteps}
          </Badge>
          
          {metrics && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(metrics.timeElapsed)}
            </Badge>
          )}
        </div>
        
        {isWorking && onStop && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onStop();
            }}
            className="h-7 px-3"
            data-testid="button-stop-generation"
          >
            <Square className="w-3 h-3 mr-1.5" />
            Stop
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {isExpanded && (
        <div className="px-4 pb-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps list - only shown when expanded */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-1">
          {steps.map((step, index) => {
            const isStepExpanded = expandedSteps.has(step.id);
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
                  <div className="flex-shrink-0">{getIcon(step)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{step.message}</p>
                    {step.fileCount !== undefined && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.fileCount} file{step.fileCount !== 1 ? 's' : ''}
                      </p>
                    )}
                    {step.linesChanged && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        <span className="text-green-500">+{step.linesChanged.added}</span>
                        {' '}
                        <span className="text-red-500">-{step.linesChanged.removed}</span>
                      </p>
                    )}
                  </div>
                  {step.collapsible && (
                    <div className="flex-shrink-0">
                      {isStepExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>

                {/* Details - shown when expanded */}
                {isStepExpanded && step.details && (
                  <div className="mt-2 ml-7 text-xs text-muted-foreground bg-background/50 rounded p-2 border border-border/50">
                    <pre className="whitespace-pre-wrap font-mono">{step.details}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Work Summary - shown when complete and metrics available */}
      {showMetrics && metrics && !isWorking && (
        <div className="border-t border-border/50 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Work Summary</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Time worked</span>
              <span className="font-semibold">{formatTime(metrics.timeElapsed)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Work done</span>
              <span className="font-semibold">{metrics.actionsCompleted} actions</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Files created</span>
              <span className="font-semibold">{metrics.filesCreated} files</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Code changed</span>
              <span className="font-mono font-semibold">
                <span className="text-green-500">+{metrics.linesAdded}</span>
                {' '}
                <span className="text-red-500">-{metrics.linesRemoved}</span>
              </span>
            </div>
            
            {metrics.tokensUsed !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tokens used</span>
                <span className="font-semibold">{metrics.tokensUsed.toLocaleString()}</span>
              </div>
            )}
            
            {metrics.cost !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Cost
                </span>
                <span className="font-semibold text-primary">${metrics.cost.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
