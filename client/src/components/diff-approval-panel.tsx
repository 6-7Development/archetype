/**
 * Diff Approval Panel - Review and approve/reject code changes
 * Shows proposed changes with approve/reject buttons
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DiffViewer } from '@/components/diff-viewer';
import { Check, X, FileCode, Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface FileChange {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
}

interface DiffApprovalPanelProps {
  changes: FileChange[];
  onApprove: (changes: FileChange[]) => Promise<void>;
  onReject: () => void;
  title?: string;
  description?: string;
  className?: string;
}

export function DiffApprovalPanel({
  changes,
  onApprove,
  onReject,
  title = "Proposed Changes",
  description,
  className,
}: DiffApprovalPanelProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set(changes.map(c => c.path)));
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set(changes.slice(0, 2).map(c => c.path)));
  const { toast } = useToast();

  const toggleFile = (path: string) => {
    const next = new Set(selectedFiles);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelectedFiles(next);
  };

  const toggleExpand = (path: string) => {
    const next = new Set(expandedFiles);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setExpandedFiles(next);
  };

  const handleApprove = async () => {
    if (selectedFiles.size === 0) {
      toast({
        title: 'No files selected',
        description: 'Select at least one file to approve',
        variant: 'destructive',
      });
      return;
    }

    setIsApproving(true);
    try {
      const selectedChanges = changes.filter(c => selectedFiles.has(c.path));
      await onApprove(selectedChanges);
      toast({
        title: 'Changes approved',
        description: `${selectedChanges.length} file(s) updated`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to apply changes',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsApproving(false);
    }
  };

  const totalAdditions = changes.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = changes.reduce((sum, c) => sum + c.deletions, 0);

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="diff-approval-panel">
      <CardHeader className="py-3 px-4 bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" />
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
              +{totalAdditions}
            </Badge>
            <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
              -{totalDeletions}
            </Badge>
          </div>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="max-h-[400px]">
          <div className="divide-y">
            {changes.map((change) => (
              <div key={change.path} className="border-b last:border-b-0">
                {/* File Header */}
                <div
                  className={cn(
                    "flex items-center justify-between px-4 py-2 cursor-pointer transition-colors",
                    selectedFiles.has(change.path) ? "bg-primary/5" : "bg-muted/20 opacity-60"
                  )}
                  onClick={() => toggleExpand(change.path)}
                  data-testid={`file-header-${change.path}`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(change.path)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleFile(change.path);
                      }}
                      className="rounded border-muted-foreground/50"
                      data-testid={`checkbox-${change.path}`}
                    />
                    <span className="text-sm font-mono">{change.path}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600">+{change.additions}</span>
                    <span className="text-xs text-red-600">-{change.deletions}</span>
                    {expandedFiles.has(change.path) ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Diff Content */}
                {expandedFiles.has(change.path) && (
                  <div className="bg-slate-50 dark:bg-slate-900/50">
                    <DiffViewer diff={change.diff} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="flex justify-between gap-2 py-3 px-4 bg-muted/20 border-t">
        <div className="text-xs text-muted-foreground">
          {selectedFiles.size} of {changes.length} files selected
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReject}
            disabled={isApproving}
            data-testid="button-reject-changes"
          >
            <X className="w-4 h-4 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isApproving || selectedFiles.size === 0}
            data-testid="button-approve-changes"
          >
            {isApproving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1" />
            )}
            Approve ({selectedFiles.size})
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default DiffApprovalPanel;
