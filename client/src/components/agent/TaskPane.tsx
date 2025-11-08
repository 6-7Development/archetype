/**
 * Task Pane - Kanban-style task management display
 * Based on Agent Chatroom UX spec
 */

import { Task, TaskStatus } from '@shared/agentEvents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Circle, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Clock
} from 'lucide-react';

interface TaskPaneProps {
  tasks: Task[];
}

const STATUS_CONFIG: Record<TaskStatus, {
  label: string;
  icon: React.ReactNode;
  color: string;
}> = {
  backlog: {
    label: 'Backlog',
    icon: <Circle className="h-3.5 w-3.5" />,
    color: 'text-gray-500 dark:text-gray-400'
  },
  in_progress: {
    label: 'In Progress',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: 'text-blue-600 dark:text-blue-400'
  },
  verifying: {
    label: 'Verifying',
    icon: <Clock className="h-3.5 w-3.5" />,
    color: 'text-yellow-600 dark:text-yellow-400'
  },
  done: {
    label: 'Done',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: 'text-green-600 dark:text-green-400'
  },
  blocked: {
    label: 'Blocked',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    color: 'text-red-600 dark:text-red-400'
  }
};

function TaskCard({ task }: { task: Task }) {
  const config = STATUS_CONFIG[task.status];
  
  const verificationPassed = task.verification?.checks.every(c => c.status === 'passed');
  const verificationFailed = task.verification?.checks.some(c => c.status === 'failed');
  
  return (
    <Card 
      className="mb-2 bg-card hover-elevate transition-all"
      data-testid={`task-card-${task.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 ${config.color}`} data-testid={`task-icon-${task.status}`}>
            {config.icon}
          </span>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug mb-1" data-testid="task-title">
              {task.title}
            </p>
            
            <div className="flex items-center gap-2 flex-wrap">
              {task.owner !== 'agent' && (
                <Badge variant="outline" className="text-xs h-5" data-testid="task-owner">
                  {task.owner}
                </Badge>
              )}
              
              {task.verification && (
                <Badge 
                  variant="outline" 
                  className={`text-xs h-5 ${
                    verificationPassed 
                      ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                      : verificationFailed
                      ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                      : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                  }`}
                  data-testid="task-verification"
                >
                  {task.verification.summary || `${task.verification.checks.length} checks`}
                </Badge>
              )}
              
              {task.artifacts && task.artifacts.length > 0 && (
                <span className="text-xs text-muted-foreground" data-testid="task-artifacts">
                  📎 {task.artifacts.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TaskPane({ tasks }: TaskPaneProps) {
  const tasksByStatus = {
    backlog: tasks.filter(t => t.status === 'backlog'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    verifying: tasks.filter(t => t.status === 'verifying'),
    done: tasks.filter(t => t.status === 'done'),
    blocked: tasks.filter(t => t.status === 'blocked')
  };

  return (
    <div className="flex flex-col h-full bg-background border-l border-border" data-testid="task-pane">
      <div className="p-3 border-b border-border">
        <h3 className="font-semibold text-sm">Tasks</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {(Object.entries(tasksByStatus) as [TaskStatus, Task[]][]).map(([status, statusTasks]) => (
            <div key={status} data-testid={`task-column-${status}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={STATUS_CONFIG[status].color}>
                  {STATUS_CONFIG[status].icon}
                </span>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {STATUS_CONFIG[status].label}
                </h4>
                <Badge variant="secondary" className="h-5 text-xs ml-auto" data-testid={`task-count-${status}`}>
                  {statusTasks.length}
                </Badge>
              </div>

              {statusTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic ml-6">No tasks</p>
              ) : (
                statusTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
