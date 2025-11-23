import { useState, useEffect } from "react";
import { Check, Circle, Loader2, X, ChevronDown, ChevronRight, Bot, ArrowRight, Play } from "lucide-react";
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
  const [taskAnimations, setTaskAnimations] = useState<Record<string, { progress: number; showArrow: boolean }>>({});

  // Detect mobile viewport
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Calculate progress
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Get current task
  const currentTask = tasks.find(t => t.status === 'in_progress');
  const hasFailed = tasks.some(t => t.status === 'failed');

  // Animation effect for task completion
  useEffect(() => {
    tasks.forEach(task => {
      if (task.status === 'completed' && !taskAnimations[task.id]?.showArrow) {
        // Animate progress bar filling up
        setTimeout(() => {
          setTaskAnimations(prev => ({
            ...prev,
            [task.id]: { progress: 0, showArrow: false }
          }));
          
          // Animate to 100%
          setTimeout(() => {
            setTaskAnimations(prev => ({
              ...prev,
              [task.id]: { progress: 100, showArrow: false }
            }));
            
            // Show checkmark/arrow after progress completes
            setTimeout(() => {
              setTaskAnimations(prev => ({
                ...prev,
                [task.id]: { progress: 100, showArrow: true }
              }));
            }, 300);
          }, 50);
        }, 100);
      }
      
      // Reset animation for non-completed tasks
      if (task.status !== 'completed' && taskAnimations[task.id]) {
        setTaskAnimations(prev => {
          const newState = { ...prev };
          delete newState[task.id];
          return newState;
        });
      }
    });
  }, [tasks.map(t => `${t.id}-${t.status}`).join(',')]);

  const handleReset = async () => {
    // Force refresh by invalidating query
    window.location.reload();
  };

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
                        "h-full transition-all duration-1000 ease-out",
                        hasFailed ? "bg-destructive" : "bg-gradient-to-r from-green-500 to-emerald-400"
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
              
              {/* Refresh button when tasks are stuck */}
              {!isGenerating && totalCount > 0 && completedCount < totalCount && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Refresh tasks"
                >
                  ↻ Reset
                </button>
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
                    animation={taskAnimations[task.id]}
                  />
                ))}
              </div>
            )}

            {/* Overall progress bar with enhanced animation */}
            {totalCount > 0 && (
              <div className="pt-2 mt-2 border-t border-border/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Overall Progress
                  </span>
                  <div className="flex items-center gap-2">
                    {completedCount === totalCount && totalCount > 0 && (
                      <div className="flex items-center gap-1 text-green-500 animate-in slide-in-from-right-2 duration-500">
                        <Check className="w-3 h-3" strokeWidth={3} />
                        <span className="text-xs font-medium">Complete!</span>
                      </div>
                    )}
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      {progressPercentage}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-1000 ease-out",
                      hasFailed ? "bg-destructive" : "bg-gradient-to-r from-green-500 via-emerald-400 to-green-300",
                      completedCount === totalCount && "animate-pulse"
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
  animation?: { progress: number; showArrow: boolean };
}

function TaskItem({ task, index, animation }: TaskItemProps) {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return (
          <div className="relative flex items-center justify-center">
            <Check className="w-4 h-4 text-green-500 animate-in zoom-in duration-300" strokeWidth={3} />
            {animation?.showArrow && (
              <ArrowRight className="w-3 h-3 text-green-500 absolute -right-1 -top-1 animate-in slide-in-from-left duration-500" strokeWidth={2} />
            )}
          </div>
        );
      case 'failed':
        return <X className="w-4 h-4 text-destructive" strokeWidth={3} />;
      case 'in_progress':
        return (
          <div className="relative">
            <Play className="w-4 h-4 text-blue-500 animate-pulse" strokeWidth={2} fill="currentColor" />
            <div className="absolute inset-0 animate-ping">
              <Play className="w-4 h-4 text-blue-500/30" strokeWidth={2} fill="currentColor" />
            </div>
          </div>
        );
      default:
        return <Circle className="w-4 h-4 text-muted-foreground/40" strokeWidth={2} />;
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'completed':
        return 'text-green-700
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
        "relative flex items-start gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-all duration-500 text-xs sm:text-sm",
        task.status === 'in_progress' && "bg-blue-500/10 border border-blue-500/20 animate-pulse",
        task.status === 'failed' && "bg-destructive/5",
        task.status === 'completed' && "bg-green-500/10 border border-green-500/20"
      )}
      data-testid={`task-item-${task.id}`}
    >
      {/* Animated progress bar for individual tasks */}
      {task.status === 'completed' && animation && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${animation.progress}%` }}
          />
        </div>
      )}

      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        {getStatusIcon()}
      </div>

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm transition-colors duration-300", getStatusColor())}>
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

      {/* Completion celebration effect */}
      {task.status === 'completed' && animation?.showArrow && (
        <div className="absolute -top-1 -right-1 pointer-events-none">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
          <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
}