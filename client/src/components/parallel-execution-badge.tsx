import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';

interface ToolExecution {
  name: string;
  duration: number; // ms
  status: 'completed' | 'running' | 'pending';
  tokens?: number;
}

interface ParallelExecutionBadgeProps {
  tools: ToolExecution[];
  totalDuration: number;
  estimatedSequentialDuration: number;
  onExpand?: () => void;
}

export function ParallelExecutionBadge({
  tools,
  totalDuration,
  estimatedSequentialDuration,
  onExpand,
}: ParallelExecutionBadgeProps) {
  const speedup = (estimatedSequentialDuration / totalDuration).toFixed(1);
  const completed = tools.filter(t => t.status === 'completed').length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1.5">
          <Zap className="h-3 w-3" />
          FAST MODE
        </Badge>
        <span className="text-xs text-muted-foreground">
          {completed}/{tools.length} tools • {speedup}x speedup
        </span>
      </div>

      {/* Tool Timeline */}
      <div className="space-y-1">
        {tools.map((tool, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className="w-24 truncate font-mono text-muted-foreground">{tool.name}</span>
            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  tool.status === 'completed'
                    ? 'bg-emerald-500'
                    : tool.status === 'running'
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-muted-foreground/30'
                }`}
                style={{
                  width: `${(tool.duration / estimatedSequentialDuration) * 100}%`,
                }}
              />
            </div>
            <span className="w-12 text-right text-muted-foreground">
              {tool.duration}ms
            </span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground pt-1 border-t border-border/30">
        Sequential: {estimatedSequentialDuration}ms | Parallel: {totalDuration}ms | Saved:{' '}
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
          {(estimatedSequentialDuration - totalDuration).toFixed(0)}ms
        </span>
      </div>
    </div>
  );
}
