import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Download, 
  ChevronRight, 
  Calendar, 
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  GitCommit,
  FileCode,
  RefreshCw
} from 'lucide-react';
import { buildApiUrl } from '@/lib/api-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BeeHiveJob {
  id: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'interrupted';
  conversationState?: Array<{
    role: 'user' | 'assistant';
    content: any;
  }>;
  lastIteration: number;
  taskListId?: string;
  error?: string;
  metadata?: {
    initialMessage?: string;
    totalIterations?: number;
    filesModified?: number;
    commitsCreated?: number;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

const statusConfig = {
  pending: { icon: Clock, color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', label: 'Pending' },
  running: { icon: Loader2, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'Running' },
  completed: { icon: CheckCircle2, color: 'bg-green-500/10 text-green-500 border-green-500/20', label: 'Completed' },
  failed: { icon: XCircle, color: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Failed' },
  interrupted: { icon: AlertCircle, color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', label: 'Interrupted' },
};

export default function JobHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: jobs = [], isLoading, refetch } = useQuery<BeeHiveJob[]>({
    queryKey: ['/api/beehive-ai/jobs'],
    queryFn: async () => {
      const res = await fetch(buildApiUrl('/api/beehive-ai/jobs'), {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
    refetchInterval: 10000,
  });

  const filtered = jobs.filter((job) => {
    const matchesSearch = 
      job.metadata?.initialMessage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selected = jobs.find((j) => j.id === selectedId);

  const handleExport = (job: BeeHiveJob) => {
    const markdown = `# Scout Job Report

**Job ID**: ${job.id}
**Status**: ${job.status}
**Created**: ${new Date(job.createdAt).toLocaleString()}
**Completed**: ${job.completedAt ? new Date(job.completedAt).toLocaleString() : 'N/A'}

## Initial Request
${job.metadata?.initialMessage || 'No initial message'}

## Metrics
- Iterations: ${job.lastIteration}
- Files Modified: ${job.metadata?.filesModified || 0}
- Commits Created: ${job.metadata?.commitsCreated || 0}

## Error (if any)
${job.error || 'None'}

## Conversation History
${job.conversationState?.map((msg, i) => `
### ${msg.role === 'user' ? 'User' : 'Scout'} (${i + 1})
${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
`).join('\n') || 'No conversation history'}
`;
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scout-job-${job.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    if (diffMins > 0) return `${diffMins}m ${diffSecs}s`;
    return `${diffSecs}s`;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" data-testid="page-job-history">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Scout Job History</h1>
            <p className="text-muted-foreground mt-2">Monitor and review Scout's autonomous work sessions</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            data-testid="button-refresh-jobs"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs by message or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-jobs"
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-filter-all">All</TabsTrigger>
              <TabsTrigger value="running" data-testid="tab-filter-running">Running</TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-filter-completed">Completed</TabsTrigger>
              <TabsTrigger value="failed" data-testid="tab-filter-failed">Failed</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase">
              {filtered.length} Job{filtered.length !== 1 ? 's' : ''}
            </h2>
            <ScrollArea className="h-[600px]">
              <div className="space-y-2 pr-4">
                {isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4 text-center">
                    No jobs found
                  </div>
                ) : (
                  filtered.map((job) => {
                    const StatusIcon = statusConfig[job.status]?.icon || Clock;
                    return (
                      <Card
                        key={job.id}
                        className={`cursor-pointer transition-colors ${selectedId === job.id ? 'bg-primary/10 border-primary' : 'hover-elevate'}`}
                        onClick={() => setSelectedId(job.id)}
                        data-testid={`card-job-${job.id}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">
                                {job.metadata?.initialMessage?.substring(0, 50) || 'Job ' + job.id.slice(0, 8)}...
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={statusConfig[job.status]?.color}>
                                  <StatusIcon className={`h-3 w-3 mr-1 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                                  {statusConfig[job.status]?.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDuration(job.createdAt, job.completedAt)}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(job.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-transform ${selectedId === job.id ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="lg:col-span-2">
            {selected ? (
              <Card className="h-full">
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span className="font-mono text-sm">{selected.id.slice(0, 8)}</span>
                        <Badge variant="outline" className={statusConfig[selected.status]?.color}>
                          {statusConfig[selected.status]?.label}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(selected.createdAt).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDuration(selected.createdAt, selected.completedAt)}
                        </span>
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(selected)}
                      data-testid="button-export-job"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  <Tabs defaultValue="overview">
                    <TabsList className="mb-4">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="conversation">Conversation</TabsTrigger>
                      <TabsTrigger value="metrics">Metrics</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-sm mb-2">Initial Request</h3>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                          {selected.metadata?.initialMessage || 'No initial message recorded'}
                        </p>
                      </div>

                      {selected.error && (
                        <div>
                          <h3 className="font-semibold text-sm mb-2 text-destructive">Error</h3>
                          <p className="text-sm bg-destructive/10 text-destructive p-3 rounded-md">
                            {selected.error}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold">{selected.lastIteration}</div>
                            <div className="text-xs text-muted-foreground">Iterations</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold flex items-center justify-center gap-1">
                              <FileCode className="h-5 w-5" />
                              {selected.metadata?.filesModified || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">Files Modified</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold flex items-center justify-center gap-1">
                              <GitCommit className="h-5 w-5" />
                              {selected.metadata?.commitsCreated || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">Commits</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold">
                              {selected.conversationState?.length || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">Messages</div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="conversation">
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-4 pr-4">
                          {selected.conversationState?.length ? (
                            selected.conversationState.map((msg, i) => (
                              <div
                                key={i}
                                className={`p-3 rounded-lg ${
                                  msg.role === 'user' 
                                    ? 'bg-primary/10 ml-8' 
                                    : 'bg-muted mr-8'
                                }`}
                              >
                                <div className="text-xs font-semibold mb-1 text-muted-foreground">
                                  {msg.role === 'user' ? 'User' : 'Scout'}
                                </div>
                                <div className="text-sm whitespace-pre-wrap">
                                  {typeof msg.content === 'string' 
                                    ? msg.content.substring(0, 500) + (msg.content.length > 500 ? '...' : '')
                                    : JSON.stringify(msg.content, null, 2).substring(0, 500)}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-muted-foreground text-center p-8">
                              No conversation history available
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="metrics" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium mb-1">Job ID</h4>
                          <p className="text-xs font-mono text-muted-foreground">{selected.id}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-1">User ID</h4>
                          <p className="text-xs font-mono text-muted-foreground">{selected.userId}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-1">Task List ID</h4>
                          <p className="text-xs font-mono text-muted-foreground">{selected.taskListId || 'N/A'}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-1">Last Updated</h4>
                          <p className="text-xs text-muted-foreground">
                            {new Date(selected.updatedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <div className="text-center p-8">
                  <FileCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold">Select a Job</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose a job from the list to view details
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
