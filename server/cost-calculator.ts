/**
 * Cost Calculator Service
 * Calculates actual costs for AI operations and infrastructure
 * with transparent markup for profitability
 */

// Anthropic Claude Sonnet 4 Pricing (2025)
export const PROVIDER_COSTS = {
  // AI Token Costs (per million tokens)
  claude_input: 3.00,           // $3/M tokens
  claude_output: 15.00,          // $15/M tokens
  claude_input_cached: 0.30,     // $0.30/M tokens (90% savings with prompt caching)
  
  // Infrastructure Costs
  storage_gb_month: 0.115,       // $0.115/GB/month (AWS RDS gp3)
  bandwidth_gb: 0.09,            // $0.09/GB (after 100GB free tier)
  backup_gb_month: 0.095,        // $0.095/GB/month (additional backups)
} as const;

// User Pricing (sustainable competitive model)
// Strategy: Modest markup (2-3x) on variable costs, profit from volume + premium features
// Overage pricing per tier:
// - Starter: $4/project (28% margin at avg usage)
// - Pro: $3/project (competitive with market)
// - Business: $2.75/project (volume discount)
// - Enterprise: $2.50/project (best rate, encourages commitment)
export const USER_PRICING = {
  // AI Token Pricing (per million tokens) - Market-competitive with small markup
  claude_input: 9.00,            // 3x markup: $3 → $9 (reasonable)
  claude_output: 45.00,          // 3x markup: $15 → $45 (reasonable)
  claude_input_cached: 0.90,     // 3x markup: $0.30 → $0.90 (with caching savings)
  
  // Infrastructure Pricing - 3x markup
  storage_gb_month: 0.35,        // 3x markup: $0.115 → $0.35
  bandwidth_gb: 0.27,            // 3x markup: $0.09 → $0.27
  backup_gb_month: 0.29,         // 3x markup: $0.095 → $0.29
} as const;

// Tier-specific overage pricing (declining as volume increases)
export const OVERAGE_PRICING = {
  starter: 4.00,    // $4/project - 28% margin on typical usage
  pro: 3.00,        // $3/project - competitive rate  
  business: 2.75,   // $2.75/project - volume discount
  enterprise: 2.50, // $2.50/project - best rate for commitment
} as const;

// Actual margin calculation: markup = (userPrice - cost) / cost
// 3x markup means: userPrice = cost × 3, so margin = (3×cost - cost) / cost = 2/3 = 66.67%
export const DEFAULT_MARGIN_PERCENT = 66.67; // 66.67% margin (3x markup on variable costs)

/**
 * Calculate cost for AI token usage
 */
export function calculateTokenCost(params: {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  usePromptCaching?: boolean;
}): {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  userPrice: number;
  marginPercent: number;
  breakdown: string;
} {
  const { inputTokens, outputTokens, cachedTokens = 0, usePromptCaching = true } = params;
  
  // Calculate provider costs (what we pay)
  const uncachedInputTokens = inputTokens - cachedTokens;
  const inputCost = usePromptCaching && cachedTokens > 0
    ? (uncachedInputTokens / 1_000_000) * PROVIDER_COSTS.claude_input +
      (cachedTokens / 1_000_000) * PROVIDER_COSTS.claude_input_cached
    : (inputTokens / 1_000_000) * PROVIDER_COSTS.claude_input;
  
  const outputCost = (outputTokens / 1_000_000) * PROVIDER_COSTS.claude_output;
  const totalCost = inputCost + outputCost;
  
  // Calculate user price (what they pay) - 10x markup for 90% margin
  const userInputPrice = usePromptCaching && cachedTokens > 0
    ? (uncachedInputTokens / 1_000_000) * USER_PRICING.claude_input +
      (cachedTokens / 1_000_000) * USER_PRICING.claude_input_cached
    : (inputTokens / 1_000_000) * USER_PRICING.claude_input;
  
  const userOutputPrice = (outputTokens / 1_000_000) * USER_PRICING.claude_output;
  const userPrice = userInputPrice + userOutputPrice;
  
  const breakdown = `
    Input: ${inputTokens.toLocaleString()} tokens × $${USER_PRICING.claude_input}/M = $${userInputPrice.toFixed(4)}
    Output: ${outputTokens.toLocaleString()} tokens × $${USER_PRICING.claude_output}/M = $${userOutputPrice.toFixed(4)}
    ${cachedTokens > 0 ? `Cached: ${cachedTokens.toLocaleString()} tokens (90% savings)` : ''}
  `.trim();
  
  return {
    inputCost,
    outputCost,
    totalCost,
    userPrice,
    marginPercent: DEFAULT_MARGIN_PERCENT,
    breakdown,
  };
}

/**
 * Calculate cost for storage usage
 */
export function calculateStorageCost(params: {
  storageGb: number;
  months?: number;
}): {
  totalCost: number;
  userPrice: number;
  marginPercent: number;
  breakdown: string;
} {
  const { storageGb, months = 1 } = params;
  
  const totalCost = storageGb * PROVIDER_COSTS.storage_gb_month * months;
  const userPrice = storageGb * USER_PRICING.storage_gb_month * months;
  
  const breakdown = `${storageGb.toFixed(2)} GB × $${USER_PRICING.storage_gb_month}/GB × ${months} month(s) = $${userPrice.toFixed(2)}`;
  
  return {
    totalCost,
    userPrice,
    marginPercent: DEFAULT_MARGIN_PERCENT,
    breakdown,
  };
}

/**
 * Calculate cost for bandwidth usage
 */
export function calculateBandwidthCost(params: {
  bandwidthGb: number;
}): {
  totalCost: number;
  userPrice: number;
  marginPercent: number;
  breakdown: string;
} {
  const { bandwidthGb } = params;
  
  // First 100GB is free
  const billableGb = Math.max(0, bandwidthGb - 100);
  
  const totalCost = billableGb * PROVIDER_COSTS.bandwidth_gb;
  const userPrice = billableGb * USER_PRICING.bandwidth_gb;
  
  const breakdown = billableGb > 0
    ? `${billableGb.toFixed(2)} GB (after 100GB free) × $${USER_PRICING.bandwidth_gb}/GB = $${userPrice.toFixed(2)}`
    : 'Within 100GB free tier';
  
  return {
    totalCost,
    userPrice,
    marginPercent: DEFAULT_MARGIN_PERCENT,
    breakdown,
  };
}

/**
 * Calculate total cost for a typical project generation
 * Based on research: average project uses 50K input + 200K output tokens
 */
export function calculateProjectCost(params: {
  inputTokens?: number;
  outputTokens?: number;
  usePromptCaching?: boolean;
}): {
  totalCost: number;
  userPrice: number;
  marginPercent: number;
  breakdown: {
    ai: ReturnType<typeof calculateTokenCost>;
  };
} {
  const {
    inputTokens = 50_000,      // Average project input
    outputTokens = 200_000,     // Average project output (code generation)
    usePromptCaching = true,
  } = params;
  
  // Assume 80% cache hit rate for input tokens (realistic with prompt caching)
  const cachedTokens = usePromptCaching ? Math.floor(inputTokens * 0.8) : 0;
  
  const ai = calculateTokenCost({
    inputTokens,
    outputTokens,
    cachedTokens,
    usePromptCaching,
  });
  
  return {
    totalCost: ai.totalCost,
    userPrice: ai.userPrice,
    marginPercent: DEFAULT_MARGIN_PERCENT,
    breakdown: { ai },
  };
}

/**
 * Calculate recommended pricing per project tier (profitable at full usage)
 */
export function calculateRecommendedPricing(): {
  costPerProject: number;
  pricePerProject: number;
  tiers: {
    name: string;
    projects: number;
    monthlyCost: number;
    monthlyPrice: number;
    pricePerProject: number;
    profit: number;
    marginPercent: number;
  }[];
} {
  const projectCalc = calculateProjectCost({});
  const costPerProject = projectCalc.totalCost; // ~$3.13
  
  const tiers = [
    {
      name: 'Free',
      projects: 3,
      monthlyCost: costPerProject * 3,
      monthlyPrice: 0,
      pricePerProject: 0,
      profit: -(costPerProject * 3), // Loss leader
      marginPercent: -100,
    },
    {
      name: 'Starter',
      projects: 12,
      monthlyCost: costPerProject * 12, // $37.56
      monthlyPrice: 39,
      pricePerProject: 3.25,
      profit: 39 - (costPerProject * 12), // $1.44
      marginPercent: ((39 - (costPerProject * 12)) / (costPerProject * 12)) * 100, // ~3.8%
    },
    {
      name: 'Pro',
      projects: 30,
      monthlyCost: costPerProject * 30, // $93.90
      monthlyPrice: 99,
      pricePerProject: 3.30,
      profit: 99 - (costPerProject * 30), // $5.10
      marginPercent: ((99 - (costPerProject * 30)) / (costPerProject * 30)) * 100, // ~5.4%
    },
    {
      name: 'Business',
      projects: 75,
      monthlyCost: costPerProject * 75, // $234.75
      monthlyPrice: 249,
      pricePerProject: 3.32,
      profit: 249 - (costPerProject * 75), // $14.25
      marginPercent: ((249 - (costPerProject * 75)) / (costPerProject * 75)) * 100, // ~6.1%
    },
    {
      name: 'Enterprise',
      projects: 250,
      monthlyCost: costPerProject * 250, // $782.50
      monthlyPrice: 799,
      pricePerProject: 3.20,
      profit: 799 - (costPerProject * 250), // $16.50
      marginPercent: ((799 - (costPerProject * 250)) / (costPerProject * 250)) * 100, // ~2.1%
    },
  ];
  
  return {
    costPerProject,
    pricePerProject: OVERAGE_PRICING.starter, // Overage pricing
    tiers,
  };
}

/**
 * Get pricing transparency summary for display to users
 */
export function getPricingTransparency(): {
  aiCosts: {
    input: string;
    output: string;
    cached: string;
  };
  infrastructureCosts: {
    storage: string;
    bandwidth: string;
  };
  margin: string;
  typical_project: string;
} {
  const projectCalc = calculateProjectCost({});
  
  return {
    aiCosts: {
      input: `$${USER_PRICING.claude_input}/M tokens (provider: $${PROVIDER_COSTS.claude_input}/M)`,
      output: `$${USER_PRICING.claude_output}/M tokens (provider: $${PROVIDER_COSTS.claude_output}/M)`,
      cached: `$${USER_PRICING.claude_input_cached}/M tokens (provider: $${PROVIDER_COSTS.claude_input_cached}/M)`,
    },
    infrastructureCosts: {
      storage: `$${USER_PRICING.storage_gb_month}/GB/month (provider: $${PROVIDER_COSTS.storage_gb_month}/GB)`,
      bandwidth: `$${USER_PRICING.bandwidth_gb}/GB (provider: $${PROVIDER_COSTS.bandwidth_gb}/GB, after 100GB free)`,
    },
    margin: `${DEFAULT_MARGIN_PERCENT}% profit margin`,
    typical_project: `~$${projectCalc.userPrice.toFixed(2)} per project (cost: $${projectCalc.totalCost.toFixed(2)})`,
  };
}
