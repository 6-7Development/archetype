import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, GitBranch, Database, Wrench, Brain, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SubagentTask {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  toolsUsed?: string[];
  tokensUsed?: number;
}

interface SubagentVisibilityPanelProps {
  tasks?: SubagentTask[];
  isActive?: boolean;
}

const AGENT_ICONS: Record<string, any> = {
  code: Wrench,
  data: Database,
  git: GitBranch,
  api: Zap,
  architect: Brain,
};

const STATUS_ICONS = {
  pending: Loader,
  running: Loader,
  completed: CheckCircle2,
  failed: AlertCircle,
};

const STATUS_COLORS = {
  pending: 'text-muted-foreground',
  running: 'text-blue-500 animate-spin',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
};

export function SubagentVisibilityPanel({
  tasks = [],
  isActive = true,
}: SubagentVisibilityPanelProps) {
  const [displayTasks, setDisplayTasks] = useState<SubagentTask[]>(tasks);

  useEffect(() => {
    setDisplayTasks(tasks);
  }, [tasks]);

  if (!isActive || displayTasks.length === 0) {
    return null;
  }

  return (
    <Card className="p-3 bg-muted/30 border-muted-foreground/20">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[hsl(var(--primary))]" />
          <h3 className="font-semibold text-sm">Active Agents</h3>
          <Badge variant="secondary" className="text-xs">{displayTasks.length}</Badge>
        </div>

        <div className="space-y-1.5">
          {displayTasks.map((task) => {
            const StatusIcon = STATUS_ICONS[task.status];
            const AgentIcon = AGENT_ICONS[task.name.split('-')[0].toLowerCase()] || Wrench;
            const statusColor = STATUS_COLORS[task.status];

            return (
              <div
                key={task.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background/50 text-xs"
              >
                <AgentIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <span className="font-medium flex-1 min-w-0 truncate">{task.name}</span>

                <div className="flex items-center gap-1.5">
                  {task.tokensUsed && (
                    <span className="text-muted-foreground">{task.tokensUsed}</span>
                  )}
                  {task.duration && (
                    <span className="text-muted-foreground">{(task.duration / 1000).toFixed(1)}s</span>
                  )}
                  <StatusIcon className={cn('h-3.5 w-3.5 flex-shrink-0', statusColor)} />
                </div>
              </div>
            );
          })}
        </div>

        {displayTasks.some(t => t.status === 'running') && (
          <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
            {displayTasks.filter(t => t.status === 'running').length} agent{displayTasks.filter(t => t.status === 'running').length !== 1 ? 's' : ''} working...
          </div>
        )}
      </div>
    </Card>
  );
}
