import { useState } from "react";
import { Check, Circle, Loader2, X, ChevronDown, ChevronRight, Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Task } from "@/hooks/use-websocket-stream";

interface TaskBoardProps {
  tasks: Task[];
  isGenerating?: boolean;
  subAgentActive?: {
    id: string;
    purpose: string;
  } | null;
  className?: string;
}

export function TaskBoard({ tasks, isGenerating, subAgentActive, className }: TaskBoardProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (tasks.length === 0 && !isGenerating) {
    return null;
  }

  // Detect mobile viewport
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Calculate progress
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Get current task
  const currentTask = tasks.find(t => t.status === 'in_progress');
  const hasFailed = tasks.some(t => t.status === 'failed');

  return (
    <Card className={cn("border-border/50 bg-background", className)} data-testid="task-board">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger 
          className="w-full hover-elevate active-elevate-2" 
          data-testid="task-board-toggle"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Task Progress
                </span>
                {totalCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {completedCount}/{totalCount}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Progress indicator */}
              {totalCount > 0 && !isOpen && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        hasFailed ? "bg-destructive" : "bg-primary"
                      )}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {progressPercentage}%
                  </span>
                </div>
              )}

              {/* Working indicator */}
              {isGenerating && (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">
                    {currentTask ? "Working..." : "Starting..."}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 px-4 py-3 space-y-2">
            {/* Sub-agent indicator */}
            {subAgentActive && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20">
                <Bot className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-foreground">
                    Sub-Agent Active
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {subAgentActive.purpose}
                  </div>
                </div>
              </div>
            )}

            {/* Task list */}
            {tasks.length === 0 && isGenerating ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating task plan...</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {tasks.map((task, index) => (
                  <TaskItem 
                    key={task.id} 
                    task={task} 
                    index={index}
                  />
                ))}
              </div>
            )}

            {/* Overall progress bar */}
            {totalCount > 0 && (
              <div className="pt-2 mt-2 border-t border-border/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Overall Progress
                  </span>
                  <span className="text-xs font-medium text-foreground tabular-nums">
                    {progressPercentage}%
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      hasFailed ? "bg-destructive" : "bg-primary"
                    )}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface TaskItemProps {
  task: Task;
  index: number;
}

function TaskItem({ task, index }: TaskItemProps) {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <Check className="w-4 h-4 text-primary" strokeWidth={3} />;
      case 'failed':
        return <X className="w-4 h-4 text-destructive" strokeWidth={3} />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground/40" strokeWidth={2} />;
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'completed':
        return 'text-foreground';
      case 'failed':
        return 'text-destructive';
      case 'in_progress':
        return 'text-foreground font-medium';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div 
      className={cn(
        "flex items-start gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-colors text-xs sm:text-sm",
        task.status === 'in_progress' && "bg-primary/5",
        task.status === 'failed' && "bg-destructive/5"
      )}
      data-testid={`task-item-${task.id}`}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        {getStatusIcon()}
      </div>

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm", getStatusColor())}>
          {task.title}
        </div>
        
        {/* Sub-agent badge */}
        {task.subAgentId && (
          <div className="mt-1">
            <Badge variant="outline" className="text-xs gap-1">
              <Bot className="w-3 h-3" />
              Sub-Agent
            </Badge>
          </div>
        )}
      </div>

      {/* Priority badge (only show for pending tasks if needed) */}
      {task.status === 'pending' && task.priority <= 3 && (
        <Badge variant="secondary" className="text-xs flex-shrink-0">
          P{task.priority}
        </Badge>
      )}
    </div>
  );
}
