import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { GitCommit, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DeploymentInfo {
  version: string;
  commitHash: string;
  commitDate: string;
  commitMessage: string;
  branch: string;
  environment: string;
  buildTime: string;
}

export function DeploymentStatus() {
  const { data } = useQuery<DeploymentInfo>({
    queryKey: ['/api/deployment-info'],
    refetchInterval: 60000,
  });

  if (!data) {
    return null;
  }

  const deploymentAge = formatDistanceToNow(new Date(data.commitDate), { addSuffix: true });

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-slate-400">
      <div className="flex items-center gap-2">
        <GitCommit className="w-3 h-3" />
        <span className="font-mono">{data.commitHash}</span>
      </div>
      <div className="hidden sm:block text-slate-600">•</div>
      <div className="flex items-center gap-2">
        <Clock className="w-3 h-3" />
        <span>Updated {deploymentAge}</span>
      </div>
      {data.environment === 'production' && (
        <>
          <div className="hidden sm:block text-slate-600">•</div>
          <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
            Live
          </Badge>
        </>
      )}
    </div>
  );
}
