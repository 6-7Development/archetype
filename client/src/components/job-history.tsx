import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2, XCircle, Clock } from "lucide-react";

interface LomuJob {
  id: string;
  jobId: string;
  status: 'completed' | 'failed' | 'interrupted';
  phaseCount: number;
  tokenCount: number;
  overallQualityScore: number;
  testsRun: boolean;
  createdAt: string;
  completedAt?: string;
}

export function JobHistory() {
  const { data: jobs, isLoading } = useQuery<LomuJob[]>({
    queryKey: ['/api/lomu-ai/jobs'],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground p-3">
        Loading job history...
      </div>
    );
  }

  const completedJobs = jobs?.filter(j => j.status === 'completed') || [];
  const failedJobs = jobs?.filter(j => j.status === 'failed') || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2 border-b">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Recent Jobs
        </h3>
        <Badge variant="secondary" className="text-xs">
          {jobs?.length || 0} total
        </Badge>
      </div>

      {jobs && jobs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No jobs yet</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {jobs?.slice(0, 10).map((job) => (
            <Card key={job.id} className="text-xs" data-testid={`job-card-${job.jobId}`}>
              <CardContent className="pt-3 pb-2">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    {job.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                    <span className="font-mono truncate">{job.jobId.slice(0, 12)}</span>
                  </div>
                  <Badge variant={job.status === 'completed' ? 'default' : 'destructive'} className="text-xs">
                    {job.status === 'completed' ? 'Done' : 'Failed'}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-muted-foreground mb-2">
                  <div>
                    <span className="opacity-60">Phases:</span> {job.phaseCount}
                  </div>
                  <div>
                    <span className="opacity-60">Tokens:</span> {(job.tokenCount / 1000).toFixed(1)}K
                  </div>
                  <div>
                    <span className="opacity-60">Quality:</span> {Math.round(job.overallQualityScore)}%
                  </div>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(job.createdAt).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                  {job.testsRun && (
                    <Badge variant="secondary" className="text-xs h-5">
                      Tests ✓
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
