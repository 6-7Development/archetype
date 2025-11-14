import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RunState, Task, RunPhase } from '@shared/agentEvents';
import { PHASE_EMOJIS, PHASE_MESSAGES } from '@shared/agentEvents';
import { Clock, CheckCircle, Loader2, AlertCircle, XCircle } from 'lucide-react';

interface RunProgressTableProps {
  runState: RunState;
}

export function RunProgressTable({ runState }: RunProgressTableProps) {
  // Group tasks by status (Kanban columns)
  const backlog = runState.tasks.filter(t => t.status === 'backlog');
  const inProgress = runState.tasks.filter(t => t.status === 'in_progress');
  const verifying = runState.tasks.filter(t => t.status === 'verifying');
  const done = runState.tasks.filter(t => t.status === 'done');
  const blocked = runState.tasks.filter(t => t.status === 'blocked');

  return (
    <Card className="p-4" data-testid="run-progress-table">
      {/* Phase Header */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
        <span className="text-2xl" aria-label={`Phase: ${runState.phase}`}>
          {PHASE_EMOJIS[runState.phase]}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base">
            Phase: {runState.phase.charAt(0).toUpperCase() + runState.phase.slice(1)}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {PHASE_MESSAGES[runState.phase]}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground flex-shrink-0">
          <div className="font-medium">
            Iteration {runState.metrics.currentIteration}/{runState.metrics.maxIterations}
          </div>
          <div>
            {runState.metrics.completedTasks}/{runState.metrics.totalTasks} tasks done
          </div>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-5 gap-3">
        <TaskColumn title="Backlog" tasks={backlog} status="backlog" />
        <TaskColumn title="In Progress" tasks={inProgress} status="in_progress" />
        <TaskColumn title="Verifying" tasks={verifying} status="verifying" />
        <TaskColumn title="Done" tasks={done} status="done" />
        <TaskColumn title="Blocked" tasks={blocked} status="blocked" />
      </div>

      {/* Error Display */}
      {runState.errors.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
            <AlertCircle className="w-4 h-4" />
            <span>Errors ({runState.errors.length})</span>
          </div>
          <div className="space-y-2">
            {runState.errors.slice(-3).map((error, i) => (
              <div 
                key={i} 
                className="text-xs bg-destructive/10 border border-destructive/20 rounded-md p-2"
              >
                <div className="font-medium text-destructive">{error.message}</div>
                <div className="text-muted-foreground mt-1">
                  Phase: {error.phase} {error.taskId && `• Task: ${error.taskId}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

interface TaskColumnProps {
  title: string;
  tasks: Task[];
  status: 'backlog' | 'in_progress' | 'verifying' | 'done' | 'blocked';
}

function TaskColumn({ title, tasks, status }: TaskColumnProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'backlog':
        return <Clock className="w-3 h-3 text-muted-foreground" />;
      case 'in_progress':
        return <Loader2 className="w-3 h-3 text-[hsl(50,98%,58%)] animate-spin" />;
      case 'verifying':
        return <Loader2 className="w-3 h-3 text-[hsl(32,94%,62%)] animate-spin" />;
      case 'done':
        return <CheckCircle className="w-3 h-3 text-[hsl(145,60%,45%)]" />;
      case 'blocked':
        return <XCircle className="w-3 h-3 text-destructive" />;
    }
  };

  const getColumnColor = () => {
    switch (status) {
      case 'in_progress':
        return 'bg-[hsl(50,98%,58%)]/10 border-[hsl(50,98%,58%)]/20';
      case 'verifying':
        return 'bg-[hsl(32,94%,62%)]/10 border-[hsl(32,94%,62%)]/20';
      case 'done':
        return 'bg-[hsl(145,60%,45%)]/10 border-[hsl(145,60%,45%)]/20';
      case 'blocked':
        return 'bg-destructive/10 border-destructive/20';
      default:
        return 'bg-muted/30 border-border/50';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className={cn(
        "font-medium text-sm flex items-center gap-2 px-2 py-1.5 rounded-md border",
        getColumnColor()
      )}>
        {getStatusIcon()}
        <span className="flex-1">{title}</span>
        <Badge variant="secondary" className="text-xs h-5">
          {tasks.length}
        </Badge>
      </div>
      
      <div className="space-y-2 min-h-[60px]">
        {tasks.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4 px-2">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} status={status} />
          ))
        )}
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  status: 'backlog' | 'in_progress' | 'verifying' | 'done' | 'blocked';
}

function TaskCard({ task, status }: TaskCardProps) {
  const getTaskColor = () => {
    switch (status) {
      case 'in_progress':
        return 'border-[hsl(50,98%,58%)]/30 bg-[hsl(50,98%,58%)]/5';
      case 'verifying':
        return 'border-[hsl(32,94%,62%)]/30 bg-[hsl(32,94%,62%)]/5';
      case 'done':
        return 'border-[hsl(145,60%,45%)]/30 bg-[hsl(145,60%,45%)]/5';
      case 'blocked':
        return 'border-destructive/30 bg-destructive/5';
      default:
        return 'border-border bg-card';
    }
  };

  return (
    <Card 
      className={cn(
        "p-2 text-sm border transition-all duration-200",
        getTaskColor()
      )} 
      data-testid={`task-${task.id}`}
    >
      <div className="font-medium text-foreground leading-tight mb-1">
        {task.title}
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <span className="truncate">Owner: {task.owner}</span>
      </div>
      
      {/* Verification Status */}
      {task.verification && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1 text-xs">
            {task.verification.checks.every(c => c.status === 'passed') && (
              <CheckCircle className="w-3 h-3 text-[hsl(145,60%,45%)]" />
            )}
            {task.verification.checks.some(c => c.status === 'failed') && (
              <XCircle className="w-3 h-3 text-destructive" />
            )}
            {task.verification.checks.some(c => c.status === 'pending') && (
              <Clock className="w-3 h-3 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">
              {task.verification.checks.filter(c => c.status === 'passed').length}/
              {task.verification.checks.length} checks passed
            </span>
          </div>
        </div>
      )}
      
      {/* Artifacts */}
      {task.artifacts && task.artifacts.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1">
          <Badge variant="outline" className="text-xs h-4">
            {task.artifacts.length} artifact{task.artifacts.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}
    </Card>
  );
}
