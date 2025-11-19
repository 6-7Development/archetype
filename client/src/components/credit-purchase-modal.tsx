import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  usd: number;
}

interface CreditPackagesData {
  packages: CreditPackage[];
}

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  pausedRunId?: string | null;
  onResumed?: () => void;
}

export function CreditPurchaseModal({ isOpen, onClose, pausedRunId, onResumed }: CreditPurchaseModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: packagesData, isLoading } = useQuery<CreditPackagesData>({
    queryKey: ["/api/credits/packages"],
    enabled: isOpen,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageId: string) => {
      return await apiRequest(
        "POST",
        `/api/credits/purchase`,
        { packageId }
      );
    },
    onSuccess: async (data) => {
      toast({
        title: "Credits purchased successfully!",
        description: `Added ${data.creditsAdded.toLocaleString()} credits to your account.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/balance"] });
      
      // Auto-resume paused agent if runId is provided
      if (pausedRunId) {
        try {
          const response = await fetch(`/api/agents/resume/${pausedRunId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ additionalCredits: 100 }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              toast({
                title: "Agent Resumed",
                description: "Your agent has been resumed and will continue working.",
              });
              onResumed?.();
            }
          }
        } catch (error) {
          console.error("Failed to auto-resume:", error);
          // Don't show error to user - they can manually resume
        }
      }
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Purchase failed",
        description: error.message || "Failed to purchase credits. Please try again.",
      });
    },
  });

  const packages = packagesData?.packages || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-credit-purchase">
        <DialogHeader>
          <DialogTitle>Purchase Credits</DialogTitle>
          <DialogDescription>
            Choose a credit package to top up your account. 1 credit = 1,000 tokens.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-3">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                className={`flex items-center justify-between p-4 border rounded-md hover-elevate active-elevate-2 ${
                  selectedPackage === pkg.id ? "border-primary bg-primary/10" : "border-border"
                }`}
                onClick={() => setSelectedPackage(pkg.id)}
                data-testid={`package-${pkg.id}`}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">{pkg.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {pkg.credits.toLocaleString()} credits
                  </span>
                </div>
                <span className="text-lg font-semibold">${pkg.usd.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-purchase">
            Cancel
          </Button>
          <Button
            onClick={() => selectedPackage && purchaseMutation.mutate(selectedPackage)}
            disabled={!selectedPackage || purchaseMutation.isPending}
            data-testid="button-confirm-purchase"
          >
            {purchaseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Purchase
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
