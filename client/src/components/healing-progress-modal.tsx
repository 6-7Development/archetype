import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react';
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
  const [currentPhase, setCurrentPhase] = useState<string>('Analyzing platform...');
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState<{
    issuesFound: number;
    issuesFixed: number;
    duration: number;
  } | null>(null);

  useEffect(() => {
    if (!jobId || !isOpen) return;

    let isMounted = true;
    const startTime = Date.now();

    // Subscribe to job stream via SSE to get real-time updates
    const setupStream = async () => {
      try {
        const response = await fetch(`/api/lomu-ai/stream/${jobId}`, {
          credentials: 'include',
          headers: {
            'Accept': 'text/event-stream',
          }
        });

        if (!response.ok || !response.body) {
          console.error('[HEALING-MODAL] Stream failed:', response.status);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!isMounted) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            // Parse SSE format: "data: {json}"
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const event = JSON.parse(data);
                
                if (event.type === 'tool_use') {
                  // Display tool calls as steps
                  setSteps(prev => [...prev, {
                    id: crypto.randomUUID(),
                    phase: `Tool: ${event.name}`,
                    action: `Executing ${event.name}...`,
                    status: 'in-progress',
                    timestamp: new Date(),
                    details: event.name
                  }]);
                  setCurrentPhase(`Running ${event.name}...`);
                } else if (event.type === 'tool_result') {
                  // Mark tool as complete
                  setSteps(prev => {
                    const updated = [...prev];
                    const lastTool = updated.findIndex(s => s.status === 'in-progress');
                    if (lastTool !== -1) {
                      updated[lastTool] = {
                        ...updated[lastTool],
                        status: 'completed'
                      };
                    }
                    return updated;
                  });
                } else if (event.type === 'text') {
                  // Display text content as analysis steps
                  const text = event.text || '';
                  if (text.includes('ITERATION')) {
                    const match = text.match(/ITERATION (\d+)/);
                    if (match) {
                      const iteration = parseInt(match[1]);
                      setCurrentPhase(`Iteration ${iteration}`);
                      setSteps(prev => [...prev, {
                        id: crypto.randomUUID(),
                        phase: `Iteration ${iteration}`,
                        action: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                        status: 'completed',
                        timestamp: new Date()
                      }]);
                    }
                  }
                } else if (event.type === 'completion') {
                  // Job complete
                  setIsComplete(true);
                  setSummary({
                    issuesFound: event.issuesFound || 0,
                    issuesFixed: event.issuesFixed || 0,
                    duration: Date.now() - startTime
                  });
                  
                  // Auto-close after 3 seconds
                  setTimeout(() => {
                    if (isMounted) onClose();
                  }, 3000);
                } else if (event.type === 'error') {
                  setSteps(prev => [...prev, {
                    id: crypto.randomUUID(),
                    phase: 'Error',
                    action: event.message || 'An error occurred',
                    status: 'failed',
                    timestamp: new Date()
                  }]);
                }
              } catch (e) {
                console.error('[HEALING-MODAL] Parse error:', e);
              }
            }
          }
        }
      } catch (error) {
        console.error('[HEALING-MODAL] Stream error:', error);
        if (isMounted) {
          setSteps(prev => [...prev, {
            id: crypto.randomUUID(),
            phase: 'Connection',
            action: 'Lost connection to healing stream',
            status: 'failed',
            timestamp: new Date()
          }]);
        }
      }
    };

    setupStream();

    return () => {
      isMounted = false;
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
                <Zap className="h-5 w-5 text-mint" />
                <span>Self-Healing Complete! 🎉</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {!isComplete ? (
              <span className="text-muted-foreground">
                Phase: <span className="text-foreground font-medium">{currentPhase}</span>
              </span>
            ) : summary ? (
              <span className="text-mint font-medium">
                Fixed {summary.issuesFixed} issues in {Math.round(summary.duration / 1000)}s
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {steps.length === 0 && !isComplete ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-honey" />
              <p className="text-muted-foreground">Initializing autonomous healing...</p>
              <p className="text-xs text-muted-foreground">LomuAI is analyzing the platform</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Status</TableHead>
                  <TableHead className="w-[120px]">Phase</TableHead>
                  <TableHead className="flex-1">Action</TableHead>
                  <TableHead className="w-[100px]">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.map((step) => (
                  <TableRow key={step.id} data-testid={`step-${step.id}`}>
                    <TableCell>{getStatusIcon(step.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs truncate">
                        {step.phase.substring(0, 20)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex-1">
                        <p className="font-medium text-sm truncate">{step.action.substring(0, 60)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right">
                      {step.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {isComplete && summary && (
          <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-mint/10 to-honey/10 border border-mint/30">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Duration</p>
                <p className="text-lg font-bold text-foreground">{Math.round(summary.duration / 1000)}s</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Issues Fixed</p>
                <p className="text-lg font-bold text-mint">{summary.issuesFixed}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                <p className="text-lg font-bold text-foreground">{Math.max(0, summary.issuesFound - summary.issuesFixed)}</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
