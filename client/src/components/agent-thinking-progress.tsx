import { useState } from 'react';
import { ChevronDown, Loader2, Check, RotateCcw, GitBranch, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  isCurrently?: boolean;
}

interface AgentThinkingProgressProps {
  taskCount: number;
  totalTasks: number;
  tasks: TaskItem[];
  isLoading?: boolean;
  onRollback?: () => void;
  onShowChanges?: () => void;
  onPreview?: () => void;
}

export function AgentThinkingProgress({
  taskCount,
  totalTasks,
  tasks,
  isLoading = false,
  onRollback,
  onShowChanges,
  onPreview,
}: AgentThinkingProgressProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-4 bg-slate-100 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors gap-3 group">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ChevronDown 
              className={cn(
                'h-4 w-4 text-slate-600 dark:text-slate-400 transition-transform',
                isOpen ? 'rotate-0' : '-rotate-90'
              )} 
            />
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate">
              In progress tasks
            </span>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {taskCount} / {totalTasks}
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent className="px-4 py-3 space-y-3 border-t border-slate-200 dark:border-slate-700">
          {/* Task List */}
          <div className="space-y-2">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-start gap-2.5 text-xs transition-colors',
                    task.completed
                      ? 'text-slate-500 dark:text-slate-400'
                      : 'text-slate-600 dark:text-slate-300'
                  )}
                >
                  {task.completed ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : task.isCurrently ? (
                    <Loader2 className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 animate-spin flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="truncate line-clamp-2">{task.title}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                No tasks yet
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 h-7 text-xs flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              onClick={onRollback}
              data-testid="button-rollback-here"
              disabled={!onRollback}
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Rollback here</span>
              <span className="sm:hidden">Rollback</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="flex-1 h-7 text-xs flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              onClick={onShowChanges}
              data-testid="button-show-changes"
              disabled={!onShowChanges}
            >
              <GitBranch className="h-3 w-3" />
              <span className="hidden sm:inline">Changes</span>
              <span className="sm:hidden">Changes</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="flex-1 h-7 text-xs flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              onClick={onPreview}
              data-testid="button-preview"
              disabled={!onPreview}
            >
              <Eye className="h-3 w-3" />
              <span className="hidden sm:inline">Preview</span>
              <span className="sm:hidden">Preview</span>
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
