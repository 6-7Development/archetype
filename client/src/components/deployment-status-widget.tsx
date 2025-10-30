import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GitCommit, Clock, ExternalLink, Bot, User, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Deployment {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorType: 'meta-sysop' | 'manual';
  timestamp: string;
  url: string;
}

interface DeploymentHistoryResponse {
  success: boolean;
  deployments: Deployment[];
  repository: string;
}

interface DeploymentStatusWidgetProps {
  floating?: boolean;
  onClose?: () => void;
}

export function DeploymentStatusWidget({ floating = false, onClose }: DeploymentStatusWidgetProps = {}) {
  const { data, isLoading } = useQuery<DeploymentHistoryResponse>({
    queryKey: ['/api/platform/deployment-history'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card 
        data-testid="card-deployment-status"
        className={cn(
          floating && "shadow-2xl backdrop-blur-sm bg-card/95"
        )}
      >
        <CardHeader className={cn(
          "space-y-0",
          floating ? "pb-2 px-3 py-2" : "pb-3"
        )}>
          <div className="flex items-center justify-between">
            <CardTitle className={cn(
              "font-medium flex items-center gap-2",
              floating ? "text-xs" : "text-base"
            )}>
              <GitCommit className={cn(floating ? "h-3 w-3" : "h-4 w-4")} />
              Recent Deployments
            </CardTitle>
            {floating && onClose && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="h-6 w-6 hover-elevate shrink-0"
                data-testid="button-close-deployments"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          <CardDescription className="text-xs">Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const deployments = data?.deployments || [];
  const latest = deployments[0];

  return (
    <Card 
      data-testid="card-deployment-status" 
      className={cn(
        "hover-elevate",
        floating && "shadow-2xl backdrop-blur-sm bg-card/95"
      )}
    >
      <CardHeader className={cn(
        "space-y-0",
        floating ? "pb-2 px-3 py-2" : "pb-3"
      )}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn(
            "font-medium flex items-center gap-2",
            floating ? "text-xs" : "text-base"
          )}>
            <GitCommit className={cn(floating ? "h-3 w-3" : "h-4 w-4")} />
            Recent Deployments
          </CardTitle>
          {floating && onClose && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="h-6 w-6 hover-elevate shrink-0"
              data-testid="button-close-deployments"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        <CardDescription className="text-xs">
          {data?.repository || 'Unknown repository'}
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(
        "space-y-3",
        floating && "p-2 max-h-64 overflow-y-auto"
      )}>
        {deployments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deployments found</p>
        ) : (
          <>
            {/* Latest deployment - highlighted */}
            {latest && (
              <div 
                className="space-y-2 p-3 rounded-md bg-muted/50 border"
                data-testid={`deployment-latest-${latest.shortHash}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant={latest.authorType === 'meta-sysop' ? 'default' : 'secondary'}
                        className="text-xs shrink-0"
                        data-testid={`badge-author-${latest.authorType}`}
                      >
                        {latest.authorType === 'meta-sysop' ? (
                          <>
                            <Bot className="h-3 w-3 mr-1" />
                            LomuAI
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3 mr-1" />
                            Manual
                          </>
                        )}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-mono">
                        {latest.shortHash}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate" title={latest.message}>
                      {latest.message}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDistanceToNow(new Date(latest.timestamp), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <a
                    href={latest.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                    data-testid="link-latest-commit"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </a>
                </div>
              </div>
            )}

            {/* Previous deployments - compact list */}
            {deployments.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Previous builds</p>
                {deployments.slice(1, 4).map((deployment) => (
                  <div
                    key={deployment.hash}
                    className="flex items-center justify-between gap-2 p-2 rounded hover-elevate"
                    data-testid={`deployment-${deployment.shortHash}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge 
                        variant={deployment.authorType === 'meta-sysop' ? 'default' : 'secondary'}
                        className="text-xs shrink-0"
                      >
                        {deployment.authorType === 'meta-sysop' ? (
                          <Bot className="h-3 w-3" />
                        ) : (
                          <User className="h-3 w-3" />
                        )}
                      </Badge>
                      <code className="text-xs font-mono text-muted-foreground">
                        {deployment.shortHash}
                      </code>
                      <span className="text-xs truncate" title={deployment.message}>
                        {deployment.message}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(deployment.timestamp), { addSuffix: true })}
                      </span>
                      <a
                        href={deployment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`link-commit-${deployment.shortHash}`}
                      >
                        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
