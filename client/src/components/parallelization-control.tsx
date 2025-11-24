/**
 * Gap #18: Parallelization Control UI
 * Toggle between parallel/sequential mode
 * Show pre-execution analysis and speedup forecast
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Zap, List } from 'lucide-react';

interface ParallelizationControlProps {
  independentTasks: number;
  estimatedSequentialMs: number;
  estimatedParallelMs: number;
  onModeChange?: (mode: 'parallel' | 'sequential') => void;
}

export function ParallelizationControl({
  independentTasks,
  estimatedSequentialMs,
  estimatedParallelMs,
  onModeChange,
}: ParallelizationControlProps) {
  const [mode, setMode] = useState<'parallel' | 'sequential'>('parallel');

  const speedup = (estimatedSequentialMs / estimatedParallelMs).toFixed(1);
  const timeSaved = (estimatedSequentialMs - estimatedParallelMs) / 1000;

  const handleModeChange = () => {
    const newMode = mode === 'parallel' ? 'sequential' : 'parallel';
    setMode(newMode);
    onModeChange?.(newMode);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>⚡ Execution Mode</span>
          <Badge variant={mode === 'parallel' ? 'default' : 'outline'}>
            {mode === 'parallel' ? 'FAST' : 'SEQUENTIAL'}
          </Badge>
        </CardTitle>
        <CardDescription>
          {independentTasks} independent tasks detected
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            {mode === 'parallel' ? (
              <Zap className="h-4 w-4 text-amber-500" />
            ) : (
              <List className="h-4 w-4 text-slate-500" />
            )}
            <span className="font-medium">{mode === 'parallel' ? 'FAST (Parallel)' : 'Sequential'}</span>
          </div>
          <Switch checked={mode === 'parallel'} onCheckedChange={handleModeChange} />
        </div>

        {/* Performance Forecast */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">⏱️ Performance Forecast</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-900">
              <p className="text-muted-foreground">Sequential</p>
              <p className="font-bold">{estimatedSequentialMs}ms</p>
            </div>
            <div className="p-2 rounded bg-amber-100 dark:bg-amber-950">
              <p className="text-muted-foreground">Parallel</p>
              <p className="font-bold text-amber-900 dark:text-amber-100">{estimatedParallelMs}ms</p>
            </div>
            <div className="p-2 rounded bg-emerald-100 dark:bg-emerald-950">
              <p className="text-muted-foreground">Speedup</p>
              <p className="font-bold text-emerald-900 dark:text-emerald-100">{speedup}x</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            💾 Time saved: <span className="font-semibold">{timeSaved.toFixed(1)}s</span>
          </p>
        </div>

        {/* Explanation */}
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 p-3">
          <p className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed">
            <strong>Why parallel?</strong> These {independentTasks} tasks don't depend on each other, so they can
            run simultaneously. This saves ~{timeSaved.toFixed(1)}s per execution.
          </p>
        </div>

        {/* Action */}
        <Button
          className="w-full"
          variant={mode === 'parallel' ? 'default' : 'outline'}
        >
          {mode === 'parallel' ? '🚀 Enable FAST Mode' : '⏸️ Use Sequential'}
        </Button>
      </CardContent>
    </Card>
  );
}
