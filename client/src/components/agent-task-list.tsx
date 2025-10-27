import { Check, Circle, Loader2, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

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
  const hasSubsteps = task.substeps && task.substeps.length > 0;

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
        
        <span className="flex-1 text-sm truncate">{task.title}</span>
        
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
