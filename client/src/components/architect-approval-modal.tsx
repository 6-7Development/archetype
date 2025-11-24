import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ArchitectRecommendation {
  filePath: string;
  changes: string;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
}

interface ArchitectApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guidance: string;
  recommendations: ArchitectRecommendation[];
  confidence: number;
  onApprove: (approvalNotes?: string) => void;
  onReject: (reason?: string) => void;
  isLoading?: boolean;
}

export function ArchitectApprovalModal({
  open,
  onOpenChange,
  guidance,
  recommendations = [],
  confidence = 0,
  onApprove,
  onReject,
  isLoading = false,
}: ArchitectApprovalModalProps) {
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const riskColor = {
    low: 'text-emerald-600 dark:text-emerald-400',
    medium: 'text-amber-600 dark:text-amber-400',
    high: 'text-red-600 dark:text-red-400',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>I AM Architect Guidance</DialogTitle>
          <DialogDescription>
            Review the architect's recommendations before applying changes
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="guidance" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="guidance">Guidance</TabsTrigger>
            <TabsTrigger value="changes">Changes ({recommendations.length})</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          {/* Guidance Tab */}
          <TabsContent value="guidance" className="space-y-3">
            <div className="rounded-lg bg-muted/30 p-4 border border-border/50">
              <p className="text-sm leading-relaxed text-foreground">{guidance}</p>
            </div>
          </TabsContent>

          {/* Changes Tab */}
          <TabsContent value="changes" className="space-y-3 max-h-96 overflow-y-auto">
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No file changes recommended</p>
            ) : (
              <div className="space-y-2">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-mono text-sm font-medium">{rec.filePath}</span>
                      </div>
                      <Badge variant="outline" className={riskColor[rec.risk]}>
                        {rec.risk.toUpperCase()}
                      </Badge>
                    </div>
                    <pre className="bg-background p-2 rounded text-xs overflow-x-auto max-h-32 border border-border/30">
                      {rec.changes}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/30 p-3 border border-border/50">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className="text-2xl font-bold text-[hsl(var(--primary))]">{confidence}%</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 border border-border/50">
                <p className="text-xs text-muted-foreground">Files Modified</p>
                <p className="text-2xl font-bold text-[hsl(var(--primary))]">{recommendations.length}</p>
              </div>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Review carefully before approving
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                    These changes will be applied to your project. Make sure they align with your goals.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Approval Notes */}
        {!showRejectForm && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Approval Notes (optional)</label>
            <Textarea
              placeholder="Document why you approved this guidance..."
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="min-h-20"
            />
          </div>
        )}

        {/* Rejection Form */}
        {showRejectForm && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Why reject this guidance?</label>
            <Textarea
              placeholder="Explain why you're rejecting this guidance..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-20"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setShowRejectForm(!showRejectForm);
              setRejectionReason('');
              setApprovalNotes('');
            }}
          >
            {showRejectForm ? 'Keep Reviewing' : 'Reject'}
          </Button>
          <Button
            onClick={() => {
              onApprove(approvalNotes);
              onOpenChange(false);
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Approving...' : 'Approve Changes'}
          </Button>
          {showRejectForm && (
            <Button
              variant="destructive"
              onClick={() => {
                onReject(rejectionReason);
                onOpenChange(false);
              }}
            >
              Confirm Rejection
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
