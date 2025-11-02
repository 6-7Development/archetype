import { Check, Circle, Loader2, AlertCircle, X, ChevronRight, ChevronDown, Clock, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface TaskTimelineTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed_pending_review' | 'completed' | 'cancelled' | 'failed';
  architectReviewed?: 'yes' | 'no' | 'not_applicable' | null;
  architectReviewReason?: string | null;
  result?: string | null;
  error?: string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

interface TaskTimelineProps {
  tasks: TaskTimelineTask[];
  activeTaskId?: string | null;
  onTaskClick?: (taskId: string) => void;
  showHeader?: boolean;
  compact?: boolean;
}

function getStatusIcon(status: TaskTimelineTask['status']) {
  switch (status) {
    case 'completed':
      return <Check className="w-4 h-4 text-[hsl(145,60%,45%)]" data-testid="icon-completed" />; // Fresh Mint
    case 'in_progress':
      return <Loader2 className="w-4 h-4 text-[hsl(50,98%,58%)] animate-spin" data-testid="icon-in_progress" />; // Sparkling Lemon
    case 'completed_pending_review':
      return <AlertTriangle className="w-4 h-4 text-[hsl(32,94%,62%)]" data-testid="icon-pending_review" />; // Citrus Bloom
    case 'cancelled':
    case 'failed':
      return <X className="w-4 h-4 text-[hsl(0,85%,60%)]" data-testid="icon-cancelled" />;
    default:
      return <Circle className="w-4 h-4 text-muted-foreground" data-testid="icon-pending" />;
  }
}

function getStatusLabel(status: TaskTimelineTask['status']): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
      return 'In progress...';
    case 'completed_pending_review':
      return 'Awaiting review';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    default:
      return 'Pending';
  }
}

function getRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch {
    return '';
  }
}

function TaskItem({ 
  task, 
  isActive, 
  onClick,
  compact = false
}: { 
  task: TaskTimelineTask; 
  isActive: boolean; 
  onClick?: () => void;
  compact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = task.description || task.result || task.error || task.architectReviewReason;
  const showTimestamp = task.status === 'completed' || task.status === 'cancelled' || task.status === 'failed';
  const timestamp = task.completedAt ? getRelativeTime(task.completedAt) : getRelativeTime(task.startedAt);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        className={cn(
          'group flex flex-col gap-1 px-3 py-2 rounded-lg transition-all duration-200',
          'hover-elevate cursor-pointer',
          isActive && 'bg-accent/50',
          !compact && 'min-h-[48px]'
        )}
        onClick={onClick}
        data-testid={`task-timeline-item-${task.id}`}
      >
        <div className="flex items-start gap-2.5 w-full">
          <div className="flex-shrink-0 mt-0.5">
            {getStatusIcon(task.status)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-sm font-medium",
                (task.status === 'cancelled' || task.status === 'failed') && "line-through text-muted-foreground"
              )}>
                {task.title}
              </span>
              
              {task.status === 'completed_pending_review' && task.architectReviewed && (
                <Badge 
                  variant={task.architectReviewed === 'yes' ? 'default' : 'secondary'}
                  className="text-xs h-5"
                >
                  {task.architectReviewed === 'yes' ? '✓ Reviewed' : 'Under Review'}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {getStatusLabel(task.status)}
              </span>
              
              {showTimestamp && timestamp && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timestamp}
                  </span>
                </>
              )}
            </div>
          </div>

          {hasDetails && (
            <CollapsibleTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="flex-shrink-0 p-1 hover:bg-accent rounded transition-colors"
                data-testid={`button-toggle-details-${task.id}`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            </CollapsibleTrigger>
          )}
        </div>

        <CollapsibleContent className="ml-6.5 mt-1">
          <div className="space-y-2 text-sm">
            {task.description && (
              <div className="text-muted-foreground">
                {task.description}
              </div>
            )}
            
            {task.result && (
              <div className="bg-[hsl(145,60%,45%)]/10 border border-[hsl(145,60%,45%)]/20 rounded-md p-2">
                <div className="text-xs font-semibold text-[hsl(145,60%,45%)] mb-1">Result:</div>
                <div className="text-xs">{task.result}</div>
              </div>
            )}
            
            {task.error && (
              <div className="bg-[hsl(0,85%,60%)]/10 border border-[hsl(0,85%,60%)]/20 rounded-md p-2">
                <div className="text-xs font-semibold text-[hsl(0,85%,60%)] mb-1">Error:</div>
                <div className="text-xs">{task.error}</div>
              </div>
            )}
            
            {task.architectReviewReason && (
              <div className="bg-[hsl(32,94%,62%)]/10 border border-[hsl(32,94%,62%)]/20 rounded-md p-2">
                <div className="text-xs font-semibold text-[hsl(32,94%,62%)] mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Architect Review:
                </div>
                <div className="text-xs">{task.architectReviewReason}</div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function TaskTimeline({ 
  tasks, 
  activeTaskId, 
  onTaskClick,
  showHeader = true,
  compact = false
}: TaskTimelineProps) {
  if (tasks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="text-4xl">💡</div>
            <div className="text-sm font-medium">Waiting for agent to start...</div>
            <div className="text-xs text-muted-foreground max-w-[280px]">
              Tasks will appear here when the AI begins working on your request.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate completion stats
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card data-testid="task-timeline">
      {showHeader && (
        <CardHeader className="pb-3 space-y-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">🎯 Agent Tasks</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {completedCount}/{totalCount}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {completionPercentage}% complete
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
            <div 
              className="h-full bg-[hsl(145,60%,45%)] transition-all duration-500 ease-out rounded-full"
              style={{ width: `${completionPercentage}%` }}
              data-testid="task-timeline-progress-bar"
            />
          </div>
        </CardHeader>
      )}
      
      <CardContent className={cn(showHeader ? 'pt-0' : 'pt-3')}>
        <div className="space-y-1" data-testid="task-timeline-list">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isActive={task.id === activeTaskId}
              onClick={() => onTaskClick?.(task.id)}
              compact={compact}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
