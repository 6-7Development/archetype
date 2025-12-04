import { useState } from 'react';
import { AlertCircle, Shield, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface ApprovalModalProps {
  isOpen: boolean;
  operation: string;
  title: string;
  description: string;
  severity: 'warning' | 'critical';
  requiresEmailConfirmation?: boolean;
  requiresReason?: boolean;
  onApprove: (approvalData: ApprovalData) => void;
  onCancel: () => void;
  userEmail?: string;
  isPending?: boolean;
}

export interface ApprovalData {
  confirmed: boolean;
  reason?: string;
  emailConfirmation?: string;
}

export function ApprovalModal({
  isOpen,
  operation,
  title,
  description,
  severity,
  requiresEmailConfirmation = false,
  requiresReason = true,
  onApprove,
  onCancel,
  userEmail,
  isPending = false,
}: ApprovalModalProps) {
  const [reason, setReason] = useState('');
  const [emailConfirmation, setEmailConfirmation] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const { toast } = useToast();

  const handleApprove = () => {
    // Validate email confirmation if required
    if (requiresEmailConfirmation && emailConfirmation !== userEmail) {
      toast({
        title: 'Verification Failed',
        description: 'Email confirmation does not match',
        variant: 'destructive',
      });
      return;
    }

    // Validate reason if required
    if (requiresReason && !reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for this operation',
        variant: 'destructive',
      });
      return;
    }

    onApprove({
      confirmed: true,
      reason: reason.trim(),
      emailConfirmation: emailConfirmation.trim(),
    });
  };

  const severityConfig = {
    warning: {
      icon: AlertCircle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    critical: {
      icon: Shield,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
  };

  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.color}`} />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Alert className={config.bgColor}>
          <AlertDescription className="text-sm">
            This operation requires owner approval and will be logged in the audit trail.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {/* Reason for operation */}
          {requiresReason && (
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for this operation *</Label>
              <Textarea
                id="reason"
                placeholder="Explain why you need to perform this operation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
                rows={3}
                data-testid="input-approval-reason"
              />
            </div>
          )}

          {/* Email confirmation */}
          {requiresEmailConfirmation && (
            <div className="space-y-2">
              <Label htmlFor="email-confirm">
                Confirm your email to proceed *
              </Label>
              <p className="text-xs text-muted-foreground">
                Type your email address to confirm
              </p>
              <Input
                id="email-confirm"
                type="email"
                placeholder={userEmail || 'your@email.com'}
                value={emailConfirmation}
                onChange={(e) => setEmailConfirmation(e.target.value)}
                disabled={isPending}
                data-testid="input-approval-email"
              />
            </div>
          )}

          {/* Confirmation checkbox */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={isPending}
              className="mt-1"
              data-testid="checkbox-approval-confirm"
            />
            <label htmlFor="confirm" className="text-sm text-muted-foreground">
              I understand that this operation will be logged and cannot be undone
              without explicit data restoration.
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            data-testid="button-approval-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleApprove}
            disabled={!confirmed || isPending || (requiresReason && !reason.trim())}
            data-testid="button-approval-confirm"
          >
            {isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Approving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve & Execute
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
