/**
 * Gap #19: Unified Metrics Dashboard
 * Compare performance across HexadAI, I AM Architect, Subagents
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AgentMetrics {
  name: string;
  tasksCompleted: number;
  successRate: number;
  avgDuration: number;
  totalTokens: number;
  costPerTask: number;
  totalCost: number;
}

const mockMetrics: AgentMetrics[] = [
  {
    name: 'HexadAI',
    tasksCompleted: 847,
    successRate: 94,
    avgDuration: 2400,
    totalTokens: 1200000,
    costPerTask: 0.5,
    totalCost: 423,
  },
  {
    name: 'I AM Architect',
    tasksCompleted: 12,
    successRate: 100,
    avgDuration: 5000,
    totalTokens: 400000,
    costPerTask: 0.1,
    totalCost: 1.2,
  },
  {
    name: 'Subagents',
    tasksCompleted: 156,
    successRate: 89,
    avgDuration: 1800,
    totalTokens: 340000,
    costPerTask: 0.22,
    totalCost: 34,
  },
];

export function UnifiedMetricsDashboard() {
  const totalTasks = mockMetrics.reduce((sum, m) => sum + m.tasksCompleted, 0);
  const totalCost = mockMetrics.reduce((sum, m) => sum + m.totalCost, 0);
  const avgSuccessRate = (
    mockMetrics.reduce((sum, m) => sum + m.successRate, 0) / mockMetrics.length
  ).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalTasks}</p>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Avg Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgSuccessRate}%</p>
            <p className="text-xs text-muted-foreground">Across all agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalCost.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">All agents combined</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance Comparison</CardTitle>
          <CardDescription>Tasks completed, success rate, and cost efficiency</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="tasksCompleted" fill="#3b82f6" name="Tasks Completed" />
              <Bar dataKey="successRate" fill="#10b981" name="Success Rate (%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockMetrics.map((agent) => (
              <div key={agent.name} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <h4 className="font-semibold">{agent.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {agent.tasksCompleted} tasks • {agent.avgDuration}ms avg
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{agent.successRate}% success</Badge>
                  <Badge variant="secondary">${agent.totalCost.toFixed(0)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>💡 Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            ✅ <strong>HexadAI</strong> is most cost-effective for general tasks (${(423 / 847).toFixed(3)} per task)
          </p>
          <p>
            ✅ <strong>I AM Architect</strong> has perfect success rate - use for critical decisions
          </p>
          <p>
            📈 <strong>Subagents</strong> are fastest (1800ms avg) - good for parallelized tasks
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
