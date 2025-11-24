/**
 * Gap #13: Token Budget Enforcement Per Subagent
 * Track and enforce token budgets to prevent runaway costs
 */

export interface TokenBudget {
  subagentId: string;
  totalBudget: number; // tokens
  used: number; // tokens
  remaining: number; // tokens
  hardLimit: boolean; // Stop immediately if exceeded?
  warningThreshold: number; // percentage (e.g., 80)
}

export interface BudgetCheckResult {
  allowed: boolean;
  budgetRemaining: number;
  isWarning: boolean;
  reason: string;
}

class TokenBudgetManager {
  private budgets: Map<string, TokenBudget> = new Map();
  private warningThreshold = 0.8; // Warn at 80%

  /**
   * Set budget for a subagent
   */
  setBudget(subagentId: string, totalBudget: number, hardLimit = true) {
    this.budgets.set(subagentId, {
      subagentId,
      totalBudget,
      used: 0,
      remaining: totalBudget,
      hardLimit,
      warningThreshold: this.warningThreshold,
    });
  }

  /**
   * Check if subagent can use tokens
   */
  canUseTokens(subagentId: string, tokensNeeded: number): BudgetCheckResult {
    const budget = this.budgets.get(subagentId);

    if (!budget) {
      return {
        allowed: true,
        budgetRemaining: Infinity,
        isWarning: false,
        reason: 'No budget set (unlimited)',
      };
    }

    if (budget.remaining < tokensNeeded) {
      return {
        allowed: !budget.hardLimit,
        budgetRemaining: budget.remaining,
        isWarning: false,
        reason: `Insufficient budget: need ${tokensNeeded}, have ${budget.remaining}`,
      };
    }

    const usagePercentage = budget.used / budget.totalBudget;
    const isWarning = usagePercentage > budget.warningThreshold;

    return {
      allowed: true,
      budgetRemaining: budget.remaining - tokensNeeded,
      isWarning,
      reason: isWarning ? `Warning: ${Math.floor(usagePercentage * 100)}% of budget used` : 'OK',
    };
  }

  /**
   * Deduct tokens from budget
   */
  deductTokens(subagentId: string, tokensUsed: number) {
    const budget = this.budgets.get(subagentId);
    if (budget) {
      budget.used += tokensUsed;
      budget.remaining = Math.max(0, budget.totalBudget - budget.used);

      console.log(
        `[TOKEN-BUDGET] ${subagentId}: used ${tokensUsed} (total: ${budget.used}/${budget.totalBudget})`,
      );
    }
  }

  /**
   * Reset budget
   */
  resetBudget(subagentId: string) {
    const budget = this.budgets.get(subagentId);
    if (budget) {
      budget.used = 0;
      budget.remaining = budget.totalBudget;
    }
  }

  /**
   * Get budget status
   */
  getBudget(subagentId: string): TokenBudget | null {
    return this.budgets.get(subagentId) || null;
  }
}

export const tokenBudgetManager = new TokenBudgetManager();
