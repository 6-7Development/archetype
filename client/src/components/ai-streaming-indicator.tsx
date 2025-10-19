import { Loader2, Brain, Zap, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AiStreamingIndicatorProps {
  status: string;
  currentThought: string;
  currentAction: string;
  currentStep: number;
  totalSteps: number;
  fullMessage: string;
}

export function AiStreamingIndicator({
  status,
  currentThought,
  currentAction,
  currentStep,
  totalSteps,
  fullMessage,
}: AiStreamingIndicatorProps) {
  if (!status && !currentAction && !currentThought) {
    return null;
  }

  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <Card className="p-4 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent" data-testid="ai-streaming-indicator">
      <div className="space-y-3">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
            <span className="text-sm font-semibold">SySop AI Working...</span>
          </div>
          {currentStep > 0 && (
            <Badge variant="outline" className="text-xs" data-testid="step-counter">
              Step {currentStep}/{totalSteps}
            </Badge>
          )}
        </div>

        {/* Progress Bar */}
        {progress > 0 && (
          <Progress value={progress} className="h-1.5" data-testid="progress-bar" />
        )}

        {/* Current Status */}
        {status && (
          <div className="flex items-start gap-2 text-xs">
            <Zap className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground" data-testid="current-status">{status}</span>
          </div>
        )}

        {/* Current Action */}
        {currentAction && (
          <div className="flex items-start gap-2 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="font-medium" data-testid="current-action">{currentAction}</span>
          </div>
        )}

        {/* Current Thought */}
        {currentThought && (
          <div className="flex items-start gap-2 text-xs">
            <Brain className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground italic" data-testid="current-thought">{currentThought}</span>
          </div>
        )}

        {/* Streaming Message Preview */}
        {fullMessage && fullMessage.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="text-xs text-muted-foreground font-mono max-h-20 overflow-y-auto" data-testid="message-preview">
              {fullMessage.substring(0, 200)}
              {fullMessage.length > 200 && '...'}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
