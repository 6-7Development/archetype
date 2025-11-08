/**
 * Artifacts Drawer - Shows files written, URLs, and build outputs
 * Based on Agent Chatroom UX spec
 */

import { ArtifactCreatedData, ArtifactUpdatedData } from '@shared/agentEvents';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Globe, 
  FileCode,
  ExternalLink,
  Copy,
  Trash2
} from 'lucide-react';

export interface Artifact {
  path: string;
  type: 'file' | 'url' | 'report';
  size?: number;
  taskId?: string;
  timestamp: string;
  operation?: 'modify' | 'delete';
}

interface ArtifactsDrawerProps {
  artifacts: Artifact[];
}

const ARTIFACT_ICONS = {
  file: FileText,
  url: Globe,
  report: FileCode
};

const ARTIFACT_COLORS = {
  file: 'text-blue-600 dark:text-blue-400',
  url: 'text-purple-600 dark:text-purple-400',
  report: 'text-green-600 dark:text-green-400'
};

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const Icon = ARTIFACT_ICONS[artifact.type];
  const color = ARTIFACT_COLORS[artifact.type];
  
  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(artifact.path);
  };

  const openUrl = () => {
    if (artifact.type === 'url') {
      window.open(artifact.path, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card 
      className="mb-2 bg-card/50 hover-elevate transition-all"
      data-testid={`artifact-${artifact.path}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} data-testid="artifact-icon" />
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono leading-snug break-all" data-testid="artifact-path">
              {artifact.path}
            </p>
            
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs h-5" data-testid="artifact-type">
                {artifact.type}
              </Badge>
              
              {artifact.size && (
                <span className="text-xs text-muted-foreground" data-testid="artifact-size">
                  {formatSize(artifact.size)}
                </span>
              )}
              
              {artifact.operation === 'delete' && (
                <Badge variant="outline" className="text-xs h-5 bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
                  deleted
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={copyToClipboard}
              data-testid="artifact-copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            
            {artifact.type === 'url' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={openUrl}
                data-testid="artifact-open-url"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ArtifactsDrawer({ artifacts }: ArtifactsDrawerProps) {
  const activeArtifacts = artifacts.filter(a => a.operation !== 'delete');
  const deletedArtifacts = artifacts.filter(a => a.operation === 'delete');

  return (
    <div className="flex flex-col h-full bg-background border-t border-border" data-testid="artifacts-drawer">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Artifacts</h3>
          <Badge variant="secondary" className="h-5 text-xs" data-testid="artifacts-count">
            {activeArtifacts.length}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {activeArtifacts.length === 0 && deletedArtifacts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8" data-testid="artifacts-empty">
              No artifacts yet
            </p>
          ) : (
            <>
              {activeArtifacts.map((artifact, index) => (
                <ArtifactCard key={`${artifact.path}-${index}`} artifact={artifact} />
              ))}
              
              {deletedArtifacts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Deleted
                  </h4>
                  {deletedArtifacts.map((artifact, index) => (
                    <ArtifactCard key={`deleted-${artifact.path}-${index}`} artifact={artifact} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
