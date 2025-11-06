import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, AlertTriangle } from "lucide-react";

interface PaymentSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentSetupModal({ isOpen, onClose }: PaymentSetupModalProps) {
  const handleSetupPayment = () => {
    window.location.href = '/account#billing';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-payment-setup">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <DialogTitle>Payment Method Required</DialogTitle>
          </div>
          <DialogDescription>
            You need to add a payment method to use AI agents. This ensures you can purchase credits when needed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-start gap-3 p-4 bg-muted rounded-md">
            <CreditCard className="h-5 w-5 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Secure Payment</p>
              <p className="text-sm text-muted-foreground">
                Your payment information is securely stored by Stripe. We never see your card details.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-payment">
            Cancel
          </Button>
          <Button onClick={handleSetupPayment} data-testid="button-setup-payment">
            Add Payment Method
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
