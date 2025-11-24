import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SwarmModeButton, SwarmVisualization } from '@/components/swarm-mode-button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, CheckCircle, XCircle, Clock, DollarSign, Zap } from 'lucide-react';

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

export default function SwarmDashboard() {
  const [activeExecution, setActiveExecution] = useState<SwarmExecution | null>(null);
  const [stats, setStats] = useState<SwarmStats | null>(null);
  const [isSwarmActive, setIsSwarmActive] = useState(false);

  useEffect(() => {
    // Fetch SWARM stats
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/swarm/stats', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch SWARM stats:', error);
    }
  };

  const handleSwarmActivate = async () => {
    try {
      const response = await fetch('/api/swarm/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: 'Test SWARM Mode execution',
          requiredTools: ['file-read', 'file-write', 'code-analyze'],
          params: {},
          priority: 'high',
          maxCost: 500,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setActiveExecution(data.execution);
        setIsSwarmActive(true);
      }
    } catch (error) {
      console.error('Failed to activate SWARM:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {isSwarmActive && <SwarmVisualization />}

      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <span className="text-5xl">🐝</span>
              SWARM Mode Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Parallel multi-agent execution with I AM Architect + Gemini Flash workers
            </p>
          </div>
          <SwarmModeButton
            onActivate={handleSwarmActivate}
            isActive={isSwarmActive}
          />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                Active Executions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.activeExecutions || 0}</p>
              <p className="text-xs text-muted-foreground">concurrent tasks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {((stats?.stats.successRate || 0) * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">completion rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-500" />
                Avg Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                ${((stats?.stats.avgCostPerDecision || 0) / 100).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">per execution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-500" />
                Avg Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {((stats?.stats.avgDurationMs || 0) / 1000).toFixed(1)}s
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
              <CardDescription>Task ID: {activeExecution.taskId}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-semibold">{activeExecution.progress}%</span>
                </div>
                <Progress value={activeExecution.progress} className="h-2" />
              </div>

              {/* Agents Used */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Agents Used</h4>
                <div className="flex gap-2">
                  {activeExecution.usedAgents.map((agent) => (
                    <Badge key={agent} variant="outline" className="gap-1">
                      {agent === 'claude-sonnet-4' ? '🧠' : '⚡'}
                      {agent}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Execution Log */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Execution Log</h4>
                <div className="bg-muted/30 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
                  {activeExecution.executionLog.map((line, idx) => (
                    <div key={idx} className="text-muted-foreground">
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              {/* Errors */}
              {activeExecution.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-red-600">Errors</h4>
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 space-y-1">
                    {activeExecution.errors.map((error, idx) => (
                      <div key={idx} className="text-sm text-red-600">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost */}
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-sm font-semibold">Total Cost</span>
                <span className="text-lg font-bold">
                  ${(activeExecution.totalCost / 100).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Tools Used */}
        {stats?.stats.topToolsUsed && stats.stats.topToolsUsed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Most Used Tools</CardTitle>
              <CardDescription>Tool execution frequency</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.stats.topToolsUsed}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tool" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#F7B500" name="Executions" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>🐝 SWARM Mode Features</CardTitle>
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
