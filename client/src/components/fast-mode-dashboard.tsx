import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Zap, Clock, TrendingUp, DollarSign } from 'lucide-react';

interface SpeedMetrics {
  date: string;
  avgSpeedup: number;
  tasksCompleted: number;
  timeSaved: number;
  extraCost: number;
  parallelTools: number;
}

interface ExecutionStat {
  task: string;
  sequential: number;
  parallel: number;
  speedup: number;
}

/**
 * Gap #17: Speed Measurement Dashboard
 * Shows FAST mode ROI - speedup metrics, time saved, cost impact
 */
export function FastModeDashboard() {
  const [metrics, setMetrics] = useState<SpeedMetrics[]>([
    { date: 'Mon', avgSpeedup: 2.1, tasksCompleted: 3, timeSaved: 0.8, extraCost: 0.05, parallelTools: 2 },
    { date: 'Tue', avgSpeedup: 2.8, tasksCompleted: 5, timeSaved: 2.1, extraCost: 0.12, parallelTools: 3 },
    { date: 'Wed', avgSpeedup: 2.4, tasksCompleted: 4, timeSaved: 1.5, extraCost: 0.08, parallelTools: 2.5 },
    { date: 'Thu', avgSpeedup: 3.2, tasksCompleted: 6, timeSaved: 3.2, extraCost: 0.18, parallelTools: 3.5 },
    { date: 'Fri', avgSpeedup: 2.6, tasksCompleted: 4, timeSaved: 1.8, extraCost: 0.10, parallelTools: 2.8 },
  ]);

  const [execStats] = useState<ExecutionStat[]>([
    { task: 'Build + Test', sequential: 2400, parallel: 900, speedup: 2.7 },
    { task: 'Lint + Format', sequential: 1200, parallel: 400, speedup: 3.0 },
    { task: 'File Analysis', sequential: 1800, parallel: 600, speedup: 3.0 },
    { task: 'Code Review', sequential: 900, parallel: 350, speedup: 2.6 },
  ]);

  // Calculate totals
  const totalSpeedup = (metrics.reduce((sum, m) => sum + m.avgSpeedup, 0) / metrics.length).toFixed(1);
  const totalTimeSaved = metrics.reduce((sum, m) => sum + m.timeSaved, 0).toFixed(1);
  const totalTasks = metrics.reduce((sum, m) => sum + m.tasksCompleted, 0);
  const totalCost = metrics.reduce((sum, m) => sum + m.extraCost, 0).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {/* Speedup Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Avg Speedup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalSpeedup}x</p>
            <p className="text-xs text-muted-foreground">vs sequential</p>
          </CardContent>
        </Card>

        {/* Time Saved Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-500" />
              Time Saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalTimeSaved}h</p>
            <p className="text-xs text-muted-foreground">this week</p>
          </CardContent>
        </Card>

        {/* Tasks Completed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalTasks}</p>
            <p className="text-xs text-muted-foreground">completed</p>
          </CardContent>
        </Card>

        {/* Cost Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-red-500" />
              Extra Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalCost}</p>
            <p className="text-xs text-muted-foreground">from parallelization</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Metrics Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily FAST Mode Performance</CardTitle>
          <CardDescription>Speedup trend over the week</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" label={{ value: 'Speedup (x)', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Time Saved (h)', angle: 90, position: 'insideRight' }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="avgSpeedup" stroke="#f59e0b" name="Avg Speedup" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="timeSaved" stroke="#10b981" name="Hours Saved" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Execution Time Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Sequential vs Parallel Execution Times</CardTitle>
          <CardDescription>Time saved per task type (milliseconds)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={execStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="task" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sequential" fill="#94a3b8" name="Sequential (ms)" />
              <Bar dataKey="parallel" fill="#10b981" name="Parallel (ms)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ROI Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>ROI Analysis</CardTitle>
          <CardDescription>Cost-benefit of parallel execution</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Time Saved Value</span>
              <Badge variant="default">${(parseFloat(totalTimeSaved) * 50).toFixed(2)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">At $50/hour effective rate</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Extra API Cost</span>
              <Badge variant="outline" className="text-red-600">${totalCost}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">From parallel tool execution</p>
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between items-center font-bold">
              <span>Net Value</span>
              <Badge variant="default" className="bg-emerald-600">${(parseFloat(totalTimeSaved) * 50 - parseFloat(totalCost)).toFixed(2)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">FAST Mode is highly profitable</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
