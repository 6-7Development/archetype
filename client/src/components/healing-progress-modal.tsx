import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HealingStep {
  id: string;
  phase: string;
  action: string;
  status: 'in-progress' | 'completed' | 'failed';
  timestamp: Date;
  details?: string;
}

interface HealingProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
}

export function HealingProgressModal({ isOpen, onClose, jobId }: HealingProgressModalProps) {
  const [steps, setSteps] = useState<HealingStep[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>('Initializing...');
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState<{
    issuesFound: number;
    issuesFixed: number;
    duration: number;
  } | null>(null);

  useEffect(() => {
    if (!jobId || !isOpen) return;

    // WebSocket connection for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('[HEALING-PROGRESS] WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Filter for our healing job
        if (data.jobId !== jobId) return;

        // Handle different event types
        switch (data.type) {
          case 'healing:step':
            setSteps(prev => [...prev, {
              id: crypto.randomUUID(),
              phase: data.phase || 'Working',
              action: data.action || data.message,
              status: 'completed',
              timestamp: new Date(),
              details: data.details
            }]);
            break;

          case 'healing:phase':
            setCurrentPhase(data.phase);
            setSteps(prev => [...prev, {
              id: crypto.randomUUID(),
              phase: data.phase,
              action: `Entering ${data.phase} phase`,
              status: 'in-progress',
              timestamp: new Date()
            }]);
            break;

          case 'healing:complete':
            setIsComplete(true);
            setSummary({
              issuesFound: data.issuesFound || 0,
              issuesFixed: data.issuesFixed || 0,
              duration: data.duration || 0
            });
            // Auto-close after 5 seconds
            setTimeout(() => {
              onClose();
            }, 5000);
            break;

          case 'healing:error':
            setSteps(prev => [...prev, {
              id: crypto.randomUUID(),
              phase: 'Error',
              action: data.message || 'An error occurred',
              status: 'failed',
              timestamp: new Date(),
              details: data.error
            }]);
            break;

          case 'tool_use':
            setSteps(prev => [...prev, {
              id: crypto.randomUUID(),
              phase: data.name || 'Tool',
              action: `Using ${data.name}`,
              status: 'in-progress',
              timestamp: new Date(),
              details: JSON.stringify(data.input)
            }]);
            break;

          case 'tool_result':
            // Update the last step with completion
            setSteps(prev => {
              const updated = [...prev];
              const lastInProgress = updated.findIndex(s => s.status === 'in-progress');
              if (lastInProgress !== -1) {
                updated[lastInProgress] = {
                  ...updated[lastInProgress],
                  status: 'completed'
                };
              }
              return updated;
            });
            break;
        }
      } catch (error) {
        console.error('[HEALING-PROGRESS] WebSocket message error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[HEALING-PROGRESS] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[HEALING-PROGRESS] WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [jobId, isOpen, onClose]);

  const getStatusIcon = (status: HealingStep['status']) => {
    switch (status) {
      case 'in-progress':
        return <Loader2 className="h-4 w-4 animate-spin text-honey" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-mint" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: HealingStep['status']) => {
    switch (status) {
      case 'in-progress':
        return <Badge variant="outline" className="bg-honey/10 text-honey border-honey/20">In Progress</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-mint/10 text-mint border-mint/20">Done</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="modal-healing-progress">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!isComplete ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-honey" />
                <span>LomuAI Self-Healing in Progress</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-mint" />
                <span>Self-Healing Complete!</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {!isComplete ? (
              <span className="text-muted-foreground">
                Current Phase: <span className="text-foreground font-medium">{currentPhase}</span>
              </span>
            ) : summary ? (
              <span className="text-mint">
                Fixed {summary.issuesFixed} of {summary.issuesFound} issues in {Math.round(summary.duration / 1000)}s
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Status</TableHead>
                <TableHead className="w-[150px]">Phase</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="w-[120px]">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-honey" />
                    <p>Initializing autonomous healing...</p>
                  </TableCell>
                </TableRow>
              ) : (
                steps.map((step) => (
                  <TableRow key={step.id} data-testid={`step-${step.id}`}>
                    <TableCell>{getStatusIcon(step.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {step.phase}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{step.action}</p>
                        {step.details && (
                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                            {step.details}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {step.timestamp.toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {isComplete && summary && (
          <div className="mt-4 p-4 rounded-lg bg-mint/10 border border-mint/20">
            <h3 className="font-semibold text-mint mb-2">Healing Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Issues Found</p>
                <p className="text-2xl font-bold text-foreground">{summary.issuesFound}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Issues Fixed</p>
                <p className="text-2xl font-bold text-mint">{summary.issuesFixed}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="text-2xl font-bold text-foreground">{Math.round(summary.duration / 1000)}s</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              This window will close automatically in a few seconds...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
