import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle2, Loader2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HealingProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
}

export function HealingProgressModal({ isOpen, onClose, jobId }: HealingProgressModalProps) {
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();
  const [startTime] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen || !jobId) return;

    // Auto-close after 4 seconds to show the "In Progress" message
    const timer = setTimeout(() => {
      setIsComplete(true);
      // Auto-close after 2 more seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    }, 4000);

    return () => clearTimeout(timer);
  }, [isOpen, jobId, onClose]);

  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="modal-healing-progress">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!isComplete ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-honey" />
                <span>Autonomous Healing in Progress</span>
              </>
            ) : (
              <>
                <Zap className="h-5 w-5 text-mint" />
                <span>Healing Started! 🤖</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isComplete ? (
            <>
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-12 w-12 animate-spin text-honey" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">BeeHiveAI is analyzing the platform</p>
                  <p className="text-xs text-muted-foreground mt-1">Diagnosing issues and planning fixes...</p>
                  <p className="text-xs text-honey font-mono mt-3">{elapsedSeconds}s elapsed</p>
                </div>
              </div>
              
              <div className="bg-honey/5 border border-honey/20 rounded-md p-3 text-xs text-muted-foreground space-y-1">
                <p>• Scanning for critical bugs</p>
                <p>• Identifying performance issues</p>
                <p>• Planning security improvements</p>
                <p>• Preparing fixes to commit</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 py-8">
                <CheckCircle2 className="h-12 w-12 text-mint" />
                <div className="text-center">
                  <p className="text-sm font-medium text-mint">Healing Process Initiated</p>
                  <p className="text-xs text-muted-foreground mt-2">BeeHiveAI is working in the background</p>
                  <p className="text-xs text-muted-foreground mt-1">Check platform health for updates</p>
                </div>
              </div>

              <div className="bg-mint/5 border border-mint/20 rounded-md p-3 text-xs text-muted-foreground">
                <p>Job ID: <span className="font-mono text-foreground">{jobId?.substring(0, 8)}...</span></p>
                <p className="mt-2">The healing process will continue in the background.</p>
                <p>This window will close automatically.</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
