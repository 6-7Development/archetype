import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SwarmModeButton } from '@/components/swarm-mode-button';
import { Activity, CheckCircle, XCircle, Clock, DollarSign, Zap, AlertTriangle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface SwarmStats {
  activeExecutions: number;
  stats: {
    totalDecisions: number;
    successRate: number;
    avgCostPerDecision: number;
    avgDurationMs: number;
    topToolsUsed: Array<{ tool: string; count: number }>;
  };
}

interface SwarmExecution {
  taskId: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  progress: number;
  usedAgents: string[];
  totalCost: number;
  executionLog: string[];
  errors: string[];
}

export default function SwarmDashboard() {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<SwarmStats>({
    queryKey: ['/api/swarm/stats'],
    refetchInterval: 5000,
  });

  const { data: activeExecution } = useQuery<SwarmExecution>({
    queryKey: [`/api/swarm/status/${activeTaskId}`],
    enabled: !!activeTaskId,
    refetchInterval: 2000,
  });

  const executeMutation = useMutation({
    mutationFn: async (params: {
      description: string;
      requiredTools: string[];
      params?: any;
      priority?: string;
      maxCost?: number;
    }) => {
      return await apiRequest('/api/swarm/execute', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onSuccess: (data: any) => {
      if (data.execution?.taskId) {
        setActiveTaskId(data.execution.taskId);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/swarm/stats'] });
    },
  });

  const handleSwarmActivate = () => {
    executeMutation.mutate({
      description: 'Test SWARM Mode execution',
      requiredTools: ['file-read', 'file-write', 'code-analyze'],
      priority: 'high',
      maxCost: 500,
    });
  };

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Activity className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading SWARM Mode data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Zap className="h-10 w-10 text-primary" />
              SWARM Mode Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Parallel multi-agent execution with I AM Architect + Gemini Flash workers
            </p>
          </div>
          <SwarmModeButton
            onActivate={handleSwarmActivate}
            isActive={executeMutation.isPending || !!activeExecution}
            data-testid="button-swarm-activate"
          />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                Active Executions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold" data-testid="text-active-executions">
                {stats?.activeExecutions || 0}
              </p>
              <p className="text-xs text-muted-foreground">concurrent tasks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold" data-testid="text-success-rate">
                {((stats?.stats?.successRate || 0) * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">completion rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-500" />
                Avg Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold" data-testid="text-avg-cost">
                ${((stats?.stats?.avgCostPerDecision || 0) / 100).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">per execution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-500" />
                Avg Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold" data-testid="text-avg-duration">
                {((stats?.stats?.avgDurationMs || 0) / 1000).toFixed(1)}s
              </p>
              <p className="text-xs text-muted-foreground">execution time</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Execution */}
        {activeExecution && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Current Execution</span>
                <Badge
                  variant={
                    activeExecution.status === 'completed'
                      ? 'default'
                      : activeExecution.status === 'failed'
                        ? 'destructive'
                        : 'secondary'
                  }
                  data-testid="badge-execution-status"
                >
                  {activeExecution.status}
                </Badge>
              </CardTitle>
              <CardDescription data-testid="text-task-id">
                Task ID: {activeExecution.taskId}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-semibold" data-testid="text-progress">
                    {activeExecution.progress}%
                  </span>
                </div>
                <Progress value={activeExecution.progress} className="h-2" />
              </div>

              {/* Agents Used */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Agents Used</h4>
                <div className="flex gap-2 flex-wrap">
                  {activeExecution.usedAgents.map((agent) => (
                    <Badge
                      key={agent}
                      variant="outline"
                      className="gap-2"
                      data-testid={`badge-agent-${agent}`}
                    >
                      <Zap className="h-3 w-3" />
                      {agent}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Execution Log */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Execution Log</h4>
                <div
                  className="bg-muted/30 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-xs space-y-1"
                  data-testid="container-execution-log"
                >
                  {activeExecution.executionLog.length > 0 ? (
                    activeExecution.executionLog.map((line, idx) => (
                      <div key={idx} className="text-muted-foreground">
                        {line}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground italic">No logs yet...</p>
                  )}
                </div>
              </div>

              {/* Errors */}
              {activeExecution.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Errors
                  </h4>
                  <div
                    className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 space-y-1"
                    data-testid="container-errors"
                  >
                    {activeExecution.errors.map((error, idx) => (
                      <div
                        key={idx}
                        className="text-sm text-red-600 dark:text-red-400"
                        data-testid={`text-error-${idx}`}
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost */}
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-sm font-semibold">Total Cost</span>
                <span className="text-lg font-bold" data-testid="text-total-cost">
                  ${(activeExecution.totalCost / 100).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Tools Used */}
        {stats?.stats?.topToolsUsed && stats.stats?.topToolsUsed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Most Used Tools</CardTitle>
              <CardDescription>Tool execution frequency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.stats?.topToolsUsed.slice(0, 10).map((item, idx) => (
                  <div
                    key={item.tool}
                    className="flex items-center justify-between"
                    data-testid={`row-tool-${idx}`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-sm font-semibold text-muted-foreground w-6">
                        #{idx + 1}
                      </span>
                      <span className="font-mono text-sm">{item.tool}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Progress
                        value={(item.count / (stats.stats?.topToolsUsed?.[0]?.count || 1)) * 100}
                        className="w-32"
                      />
                      <span
                        className="text-sm font-bold w-16 text-right"
                        data-testid={`text-tool-count-${idx}`}
                      >
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              SWARM Mode Features
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold">Parallel Execution</h4>
                <p className="text-sm text-muted-foreground">
                  Run up to 4 independent tasks simultaneously for 2.5-3.2x speedup
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold">Dependency Checking</h4>
                <p className="text-sm text-muted-foreground">
                  Automatic topological sorting ensures tasks run in correct order
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold">Guard Rails</h4>
                <p className="text-sm text-muted-foreground">
                  RCE prevention, input sanitization, rate limiting, sandbox execution
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Activity className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold">Audit Trail</h4>
                <p className="text-sm text-muted-foreground">
                  Complete decision logging for compliance and debugging
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
