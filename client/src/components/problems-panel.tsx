import { AlertCircle, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Problem {
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  column?: number;
  message: string;
  source?: string;
}

export function ProblemsPanel() {
  const { data, isLoading, refetch } = useQuery<{ problems: Problem[] }>({
    queryKey: ['/api/problems'],
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  const problems = data?.problems || [];

  const errors = problems.filter((p) => p.severity === 'error').length;
  const warnings = problems.filter((p) => p.severity === 'warning').length;

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          Problems
          <Badge variant="outline">{problems.length}</Badge>
        </h3>
        <div className="flex gap-2 items-center">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-problems"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <div className="flex gap-2 text-xs">
            <span className="text-destructive">{errors} errors</span>
            <span className="text-yellow-600">{warnings} warnings</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {problems.map((problem, i) => (
          <Card
            key={i}
            className="p-2 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{getIcon(problem.severity)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono font-semibold truncate">
                  {problem.file}:{problem.line}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {problem.message}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {problems.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-center">
          <p className="text-xs text-muted-foreground">No problems detected</p>
        </div>
      )}
    </div>
  );
}
