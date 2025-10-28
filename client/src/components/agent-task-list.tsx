import { Check, Circle, Loader2, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export interface AgentTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: { current: number; total: number };
  substeps?: AgentTask[];
}

interface AgentTaskListProps {
  tasks: AgentTask[];
  activeTaskId?: string | null;
  onTaskClick?: (taskId: string) => void;
}

function TaskIcon({ status }: { status: AgentTask['status'] }) {
  switch (status) {
    case 'completed':
      return <Check className="w-4 h-4 text-emerald-500" data-testid={`task-icon-completed`} />;
    case 'in_progress':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" data-testid={`task-icon-in_progress`} />;
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-red-500" data-testid={`task-icon-failed`} />;
    default:
      return <Circle className="w-4 h-4 text-muted-foreground" data-testid={`task-icon-pending`} />;
  }
}

function TaskItem({ 
  task, 
  isActive, 
  onClick 
}: { 
  task: AgentTask; 
  isActive: boolean; 
  onClick?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const hasSubsteps = task.substeps && task.substeps.length > 0;

  // Animate progress for in_progress tasks (indeterminate animation)
  useEffect(() => {
    if (task.status === 'in_progress') {
      const interval = setInterval(() => {
        setAnimatedProgress((prev) => {
          // Create a pulsing effect between 20% and 80%
          const next = prev + 2;
          if (next > 80) return 20;
          return next;
        });
      }, 50);
      return () => clearInterval(interval);
    } else {
      setAnimatedProgress(0);
    }
  }, [task.status]);

  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
          isActive && 'bg-accent',
          !isActive && 'hover:bg-accent/50'
        )}
        onClick={onClick}
        data-testid={`task-item-${task.id}`}
      >
        {hasSubsteps && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-accent rounded shrink-0"
            data-testid={`button-toggle-${task.id}`}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        
        <TaskIcon status={task.status} />
        
        <div className="flex-1 min-w-0">
          <span className="block text-sm truncate">{task.title}</span>
          
          {/* Progress bar for in_progress tasks */}
          {task.status === 'in_progress' && (
            <div className="mt-1">
              <Progress 
                value={animatedProgress} 
                className="h-1" 
                data-testid={`progress-${task.id}`}
              />
            </div>
          )}
        </div>
        
        {task.progress && (
          <span className="text-xs text-muted-foreground shrink-0">
            {task.progress.current}/{task.progress.total}
          </span>
        )}
      </div>

      {hasSubsteps && isExpanded && (
        <div className="ml-6 space-y-0.5">
          {task.substeps!.map((substep) => (
            <TaskItem
              key={substep.id}
              task={substep}
              isActive={false}
              onClick={() => onClick?.()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentTaskList({ tasks, activeTaskId, onTaskClick }: AgentTaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        No tasks yet
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2" data-testid="agent-task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          isActive={task.id === activeTaskId}
          onClick={() => onTaskClick?.(task.id)}
        />
      ))}
    </div>
  );
}
