/**
 * Live Status Strip - Shows current agent phase with emoji indicators
 * Based on Agent Chatroom UX spec
 */

import { RunPhase, PHASE_EMOJIS, PHASE_MESSAGES } from '@shared/agentEvents';
import { Badge } from '@/components/ui/badge';
import { Loader2, Coins } from 'lucide-react';

export interface BillingMetrics {
  inputTokens: number;
  outputTokens: number;
  creditsUsed: number;
  creditsReserved: number;
  creditBalance: number;
  costUsd: number;
  isFreeAccess: boolean;
  initialMonthlyCredits?: number;
}

interface StatusStripProps {
  phase: RunPhase;
  message?: string;
  currentThought?: string;
  isExecuting?: boolean;
  billingMetrics?: BillingMetrics;
}

const PHASE_COLORS: Record<RunPhase, string> = {
  thinking: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-800',
  planning: 'bg-purple-500/10 text-purple-700 border-purple-200 dark:border-purple-800',
  working: 'bg-orange-500/10 text-orange-700 border-orange-200 dark:border-orange-800',
  verifying: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:border-emerald-800',
  complete: 'bg-green-500/10 text-green-700 border-green-200 dark:border-green-800'
};

export function StatusStrip({ phase, message, currentThought, isExecuting = false, billingMetrics }: StatusStripProps) {
  const emoji = PHASE_EMOJIS[phase];
  const defaultMessage = PHASE_MESSAGES[phase];
  const displayMessage = currentThought || message || defaultMessage;

  // Calculate balance percentage for color coding
  const getBalanceColor = (balance: number, monthlyAllowance: number = 5000) => {
    // Guard against zero or invalid allowance
    const safeAllowance = monthlyAllowance > 0 ? monthlyAllowance : 5000;
    const percentageRemaining = (balance / safeAllowance) * 100;
    
    if (percentageRemaining > 50) return 'text-green-600 // >50% = green
    if (percentageRemaining > 20) return 'text-yellow-600 // 20-50% = yellow
    return 'text-red-600 // <20% = red
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card/50 border-b border-border" data-testid="agent-status-strip">
      <Badge 
        variant="outline" 
        className={`${PHASE_COLORS[phase]} font-medium`}
        data-testid={`status-badge-${phase}`}
      >
        <span className="mr-1.5">{emoji}</span>
        <span className="capitalize">{phase}</span>
      </Badge>
      
      {isExecuting && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" data-testid="status-spinner" />
      )}
      
      <span className="text-sm text-muted-foreground flex-1" data-testid="status-message">
        {displayMessage}
      </span>

      {/* Billing Cost Meter */}
      {billingMetrics && (
        <div className="flex items-center gap-3 text-xs" data-testid="billing-cost-meter">
          {billingMetrics.isFreeAccess ? (
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200 dark:border-green-800" data-testid="badge-free-access">
              <Coins className="h-3 w-3 mr-1" />
              FREE ACCESS
            </Badge>
          ) : (
            <>
              {/* Token usage */}
              {(billingMetrics.inputTokens > 0 || billingMetrics.outputTokens > 0) && (
                <span className="text-muted-foreground" data-testid="text-token-usage">
                  <span className="font-mono">{billingMetrics.inputTokens.toLocaleString()}</span>in / 
                  <span className="font-mono ml-1">{billingMetrics.outputTokens.toLocaleString()}</span>out
                </span>
              )}

              {/* Credits used/reserved */}
              {(billingMetrics.creditsUsed > 0 || billingMetrics.creditsReserved > 0) && (
                <span className="text-muted-foreground" data-testid="text-credits-used">
                  <Coins className="h-3 w-3 inline mr-1" />
                  <span className="font-mono">{billingMetrics.creditsUsed.toLocaleString()}</span>
                  {billingMetrics.creditsReserved > 0 && (
                    <>
                      {' '}/{' '}
                      <span className="font-mono">{billingMetrics.creditsReserved.toLocaleString()}</span>
                    </>
                  )}
                </span>
              )}

              {/* Credit balance */}
              {billingMetrics.creditBalance > 0 && (
                <span 
                  className={`font-medium ${getBalanceColor(billingMetrics.creditBalance, billingMetrics.initialMonthlyCredits || 5000)}`}
                  data-testid="text-credit-balance"
                >
                  <span className="font-mono">{billingMetrics.creditBalance.toLocaleString()}</span> credits
                  {' '}
                  <span className="text-muted-foreground">
                    (${billingMetrics.costUsd.toFixed(4)})
                  </span>
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
