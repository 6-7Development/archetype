import { CheckCircle, Clock, PartyPopper, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AgentTask } from "./agent-task-list";

interface TaskProgressWidgetProps {
  tasks: AgentTask[];
  activeTaskId: string | null;
}

export function TaskProgressWidget({ tasks, activeTaskId }: TaskProgressWidgetProps) {
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  if (tasks.length === 0) {
    return null;
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 space-y-0 pb-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          {allCompleted ? (
            <>
              <PartyPopper className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Tasks Complete!</span>
            </>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Task Progress</span>
            </>
          )}
        </CardTitle>
        <div className="text-xs text-muted-foreground mt-1">
          {completedCount} of {totalCount} completed
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto space-y-2">
        {tasks.map((task) => {
          const isActive = task.id === activeTaskId;
          const isCompleted = task.status === 'completed';
          const isPending = task.status === 'pending';
          
          return (
            <div
              key={task.id}
              data-testid={`task-item-${task.id}`}
              className={cn(
                "p-3 rounded-lg border transition-all",
                isActive && "border-primary bg-primary/5",
                isCompleted && "border-green-600/30 bg-green-600/5",
                isPending && "border-border bg-muted/30"
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4 text-green-600" data-testid="icon-completed" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" data-testid="icon-active" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" data-testid="icon-pending" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm font-medium leading-tight",
                    isCompleted && "text-green-700",
                    isActive && "text-primary",
                    isPending && "text-muted-foreground"
                  )}>
                    {task.title}
                  </div>
                  
                  {task.description && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
