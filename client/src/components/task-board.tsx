import { useState, useMemo, memo } from "react";
import { Check, Circle, Loader2, X, ChevronDown, ChevronRight, Bot, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  onRefresh?: () => void;
  lastUpdated?: Date;
}

export const TaskBoard = memo(function TaskBoard({ 
  tasks, 
  isGenerating, 
  subAgentActive, 
  className, 
  onRefresh,
  lastUpdated 
}: TaskBoardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Memoized calculations for performance
  const taskStats = useMemo(() => {
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const totalCount = tasks.length;
    const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const currentTask = tasks.find(t => t.status === 'in_progress');
    const hasFailed = tasks.some(t => t.status === 'failed');
    
    return {
      completedCount,
      totalCount,
      progressPercentage,
      currentTask,
      hasFailed
    };
  }, [tasks]);

  const handleRefresh = async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
        // Add a small delay for visual feedback
        setTimeout(() => setIsRefreshing(false), 300);
      } catch (error) {
        setIsRefreshing(false);
      }
    }
  };

  const formatLastUpdated = (date?: Date) => {
    if (!date) return null;
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (taskStats.totalCount === 0 && !isGenerating) {
    return null;
  }

  return (
    <Card 
      className={cn(
        "border-border/50 bg-background transition-all duration-300",
        isRefreshing && "ring-2 ring-primary/20 bg-primary/5",
        className
      )} 
      data-testid="task-board"
    >
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
                {taskStats.totalCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {taskStats.completedCount}/{taskStats.totalCount}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Last updated timestamp */}
              {lastUpdated && !isOpen && (
                <span className="text-xs text-muted-foreground">
                  {formatLastUpdated(lastUpdated)}
                </span>
              )}

              {/* Progress indicator */}
              {taskStats.totalCount > 0 && !isOpen && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        taskStats.hasFailed ? "bg-destructive" : "bg-primary"
                      )}
                      style={{ width: `${taskStats.progressPercentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {taskStats.progressPercentage}%
                  </span>
                </div>
              )}

              {/* Working indicator */}
              {isGenerating && (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">
                    {taskStats.currentTask ? "Working..." : "Starting..."}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 px-4 py-3 space-y-2">
            {/* Refresh control */}
            {onRefresh && (
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {lastUpdated && (
                    <span className="text-xs text-muted-foreground">
                      Updated {formatLastUpdated(lastUpdated)}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-7 px-2 text-xs"
                >
                  <RefreshCw className={cn(
                    "w-3.5 h-3.5 mr-1",
                    isRefreshing && "animate-spin"
                  )} />
                  Refresh
                </Button>
              </div>
            )}

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
            {taskStats.totalCount === 0 && isGenerating ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating task plan...</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {tasks.map((task, index) => (
                  <TaskItem 
                    key={`${task.id}-${task.status}`} // Better key for re-renders
                    task={task} 
                    index={index}
                  />
                ))}
              </div>
            )}

            {/* Overall progress bar */}
            {taskStats.totalCount > 0 && (
              <div className="pt-2 mt-2 border-t border-border/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Overall Progress
                  </span>
                  <span className="text-xs font-medium text-foreground tabular-nums">
                    {taskStats.progressPercentage}%
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      taskStats.hasFailed ? "bg-destructive" : "bg-primary",
                      isRefreshing && "animate-pulse"
                    )}
                    style={{ width: `${taskStats.progressPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});

interface TaskItemProps {
  task: Task;
  index: number;
}

const TaskItem = memo(function TaskItem({ task, index }: TaskItemProps) {
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
        "flex items-start gap-3 px-3 py-2 rounded-md transition-all duration-300",
        task.status === 'in_progress' && "bg-primary/5 animate-pulse",
        task.status === 'failed' && "bg-destructive/5",
        task.status === 'completed' && "animate-in fade-in-0 duration-300"
      )}
      data-testid={`task-item-${task.id}`}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        {getStatusIcon()}
      </div>

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm transition-colors", getStatusColor())}>
          {task.title}
        </div>
        
        {/* Result text for completed tasks */}
        {task.status === 'completed' && task.result && (
          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {task.result}
          </div>
        )}
        
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
});