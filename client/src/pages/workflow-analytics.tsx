import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, BarChart3, TrendingUp, Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface WorkflowSummary {
  totalJobs: number;
  avgPhaseCompliance: number;
  avgTestCoverage: number;
  avgTokenEfficiency: number;
  avgOverallQuality: number;
  totalViolations: number;
  avgViolationsPerJob: number;
  complianceRate: number;
  testingRate: number;
}

interface TimelineData {
  date: string;
  jobCount: number;
  avgQuality: number;
  violations: number;
}

interface ViolationsData {
  byType: Record<string, number>;
  recentViolations: Array<{
    type: string;
    phase: string;
    message: string;
    timestamp: string;
    jobId: string;
  }>;
}

interface JobMetric {
  id: string;
  jobId: string;
  phaseComplianceScore: number;
  testCoverageScore: number;
  tokenEfficiencyScore: number;
  overallQualityScore: number;
  violationCount: number;
  totalTokens: number;
  jobStatus: string;
  createdAt: string;
}

export default function WorkflowAnalytics() {
  const [dateRange, setDateRange] = useState<string>('7d');
  
  // Calculate date range
  const getDateParams = () => {
    const end = new Date();
    const start = new Date();
    
    switch (dateRange) {
      case '24h':
        start.setDate(end.getDate() - 1);
        break;
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
    }
    
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  };
  
  const dateParams = getDateParams();
  
  // Fetch summary data
  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } = useQuery<WorkflowSummary>({
    queryKey: ['/api/workflow-metrics/summary', dateParams],
    staleTime: 30000, // 30 seconds
  });
  
  // Fetch timeline data
  const { data: timeline, isLoading: timelineLoading, refetch: refetchTimeline } = useQuery<TimelineData[]>({
    queryKey: ['/api/workflow-metrics/timeline', dateParams],
    staleTime: 30000,
  });
  
  // Fetch violations data
  const { data: violations, isLoading: violationsLoading, refetch: refetchViolations } = useQuery<ViolationsData>({
    queryKey: ['/api/workflow-metrics/violations', dateParams],
    staleTime: 30000,
  });
  
  // Fetch recent jobs
  const { data: recentJobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery<JobMetric[]>({
    queryKey: ['/api/workflow-metrics/recent-jobs', dateParams],
    staleTime: 30000,
  });
  
  // Refresh all data
  const handleRefresh = () => {
    refetchSummary();
    refetchTimeline();
    refetchViolations();
    refetchJobs();
  };
  
  // Citrus colors for charts (from design system)
  const COLORS = {
    primary: 'hsl(50, 98%, 58%)', // Sparkling Lemon
    success: 'hsl(145, 60%, 45%)', // Fresh Mint
    warning: 'hsl(32, 94%, 62%)', // Citrus Bloom
    error: 'hsl(0, 85%, 60%)',
    muted: 'hsl(210, 12%, 65%)',
  };
  
  const VIOLATION_COLORS = ['#FCD34D', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  
  // Prepare violations chart data
  const violationsChartData = violations ? Object.entries(violations.byType).map(([type, count]) => ({
    name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: count,
  })) : [];
  
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-analytics-title">
            <BarChart3 className="w-8 h-8 text-primary" />
            Hexad v2.0 Workflow Analytics
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-analytics-description">
            Comprehensive metrics for workflow enforcement and quality
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Selector */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]" data-testid="select-date-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h" data-testid="option-24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d" data-testid="option-7d">Last 7 Days</SelectItem>
              <SelectItem value="30d" data-testid="option-30d">Last 30 Days</SelectItem>
              <SelectItem value="90d" data-testid="option-90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Refresh Button */}
          <Button 
            variant="outline" 
            size="default" 
            onClick={handleRefresh}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Error State */}
      {summaryError && (
        <Card className="border-destructive" data-testid="card-error">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <p>Failed to load analytics data. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : summary ? (
          <>
            <Card data-testid="card-phase-compliance">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Phase Compliance</CardTitle>
                <Activity className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-phase-compliance-score">
                  {summary.avgPhaseCompliance}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.complianceRate}% complete all 7 phases
                </p>
              </CardContent>
            </Card>
            
            <Card data-testid="card-test-coverage">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Test Coverage</CardTitle>
                <CheckCircle className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-test-coverage-score">
                  {summary.avgTestCoverage}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.testingRate}% of jobs ran tests
                </p>
              </CardContent>
            </Card>
            
            <Card data-testid="card-token-efficiency">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Token Efficiency</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-token-efficiency-score">
                  {summary.avgTokenEfficiency}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.totalJobs} jobs analyzed
                </p>
              </CardContent>
            </Card>
            
            <Card data-testid="card-overall-quality">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Overall Quality</CardTitle>
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-overall-quality-score">
                  {summary.avgOverallQuality}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.avgViolationsPerJob.toFixed(1)} violations/job
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="md:col-span-2 lg:col-span-4">
            <CardContent className="pt-6 text-center text-muted-foreground">
              No data available for selected period
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Quality Trend Chart */}
        <Card data-testid="card-quality-trend">
          <CardHeader>
            <CardTitle>Quality Score Trend</CardTitle>
            <CardDescription>Daily average quality over time</CardDescription>
          </CardHeader>
          <CardContent>
            {timelineLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : timeline && timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="avgQuality" 
                    stroke={COLORS.primary} 
                    strokeWidth={2}
                    name="Avg Quality"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No timeline data available
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Violations Breakdown */}
        <Card data-testid="card-violations-breakdown">
          <CardHeader>
            <CardTitle>Violations Breakdown</CardTitle>
            <CardDescription>Distribution by violation type</CardDescription>
          </CardHeader>
          <CardContent>
            {violationsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : violationsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={violationsChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {violationsChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={VIOLATION_COLORS[index % VIOLATION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No violations detected
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Jobs Table */}
      <Card data-testid="card-recent-jobs">
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
          <CardDescription>Latest workflow executions with metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentJobs && recentJobs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead className="text-center">Quality</TableHead>
                    <TableHead className="text-center">Phase</TableHead>
                    <TableHead className="text-center">Tests</TableHead>
                    <TableHead className="text-center">Tokens</TableHead>
                    <TableHead className="text-center">Violations</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentJobs.map((job) => (
                    <TableRow key={job.id} data-testid={`row-job-${job.jobId}`}>
                      <TableCell className="font-mono text-xs">
                        {job.jobId.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={job.overallQualityScore >= 80 ? 'default' : 'secondary'}>
                          {job.overallQualityScore}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={job.phaseComplianceScore >= 80 ? 'default' : 'secondary'}>
                          {job.phaseComplianceScore}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={job.testCoverageScore >= 80 ? 'default' : 'secondary'}>
                          {job.testCoverageScore}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {job.totalTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={job.violationCount === 0 ? 'default' : 'destructive'}
                          data-testid={`badge-violations-${job.jobId}`}
                        >
                          {job.violationCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={job.jobStatus === 'completed' ? 'default' : 'destructive'}
                          data-testid={`badge-status-${job.jobId}`}
                        >
                          {job.jobStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No jobs found for selected period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
