import { useQuery } from "@tanstack/react-query";
import { Coins, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CreditPurchaseModal } from "./credit-purchase-modal";

export function CreditBalanceWidget() {
  const [showPurchase, setShowPurchase] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/credits/balance'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground" data-testid="credit-balance-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="flex items-center gap-2 text-destructive" data-testid="credit-balance-error">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">Error loading credits</span>
      </div>
    );
  }

  const balance = data.balance;
  const isLow = balance.available < 1000; // Warning if less than 1K credits

  return (
    <>
      <div className="flex items-center gap-2" data-testid="credit-balance-widget">
        <Coins className={`h-4 w-4 ${isLow ? 'text-warning' : 'text-primary'}`} />
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${isLow ? 'text-warning' : ''}`} data-testid="credit-balance-amount">
            {balance.available.toLocaleString()} credits
          </span>
          <span className="text-xs text-muted-foreground">
            {balance.reserved > 0 && `(${balance.reserved} reserved)`}
          </span>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => setShowPurchase(true)}
          data-testid="button-buy-credits"
        >
          Top Up
        </Button>
      </div>

      {showPurchase && (
        <CreditPurchaseModal 
          isOpen={showPurchase} 
          onClose={() => setShowPurchase(false)} 
        />
      )}
    </>
  );
}
