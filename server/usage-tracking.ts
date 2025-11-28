import { db } from "./db";
import { usageLogs, subscriptions, monthlyUsage, users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

// Anthropic Claude Sonnet 4 Pricing (per 1M tokens)
const ANTHROPIC_PRICING = {
  INPUT_COST_PER_1M: 3.00,  // $3 per 1M input tokens
  OUTPUT_COST_PER_1M: 15.00, // $15 per 1M output tokens
  BLENDED_RATE_PER_1K: 0.012, // $0.012 per 1K tokens (25% input, 75% output weighted average)
};

// Google Gemini 2.5 Flash Pricing (per 1M tokens)
const GEMINI_PRICING = {
  INPUT_COST_PER_1M: 0.10,  // $0.10 per 1M input tokens (Gemini 2.5 Flash)
  OUTPUT_COST_PER_1M: 0.40, // $0.40 per 1M output tokens
};

// Replit-style Granular Pricing
const COMPUTE_PRICING = {
  COST_PER_HOUR: 0.16, // $0.16 per compute hour
  COST_PER_1M_UNITS: 3.20, // $3.20 per 1M compute units
};

const REQUEST_PRICING = {
  COST_PER_1M_REQUESTS: 1.20, // $1.20 per 1M API requests
};

const DATA_TRANSFER_PRICING = {
  COST_PER_GIB: 0.10, // $0.10 per GiB transferred
  BYTES_PER_GIB: 1024 * 1024 * 1024, // 1 GiB in bytes
};

// Storage & Deployment Pricing
const STORAGE_PRICING = {
  COST_PER_GB_MONTH: 1.50, // $1.50 per GB/month (Replit-aligned)
  BYTES_PER_GB: 1024 * 1024 * 1024, // 1 GB in bytes
};

const DEPLOYMENT_PRICING = {
  COST_PER_1K_VISITS: 0.10, // $0.10 per 1,000 visits (bandwidth)
};

// Plan limits and costs - V4.0 PROFITABLE TOKEN-BASED PRICING
// Match industry standard (1:1 credit-to-dollar) while ensuring 50-65% profit margins
// Customer pays all costs: AI ($0.012/1K) + Infrastructure + Storage + Profit
// Average Hexad project: ~83K tokens = $1.00 cost → $1.50-2.00 revenue (50-100% margin)
export const PLAN_LIMITS = {
  free: {
    aiCredits: -1, // Unlimited projects (limited by tokens)
    monthlyCost: 0,
    tokenLimit: 50000, // 50 credits ($2.50 value) - trial only
    overageRate: 0, // No overages - must upgrade
    trialOnly: true,
  },
  starter: {
    aiCredits: -1, // Unlimited projects (limited by tokens)
    monthlyCost: 49,
    tokenLimit: 980000, // 980 credits ($49 value) - matches 1:1 ratio like Cursor/Replit
    overageRate: 0.06, // $0.06 per 1K tokens (5× provider cost, 80% margin)
  },
  pro: {
    aiCredits: -1, // Unlimited projects (limited by tokens)
    monthlyCost: 129,
    tokenLimit: 2580000, // 2,580 credits ($129 value) - matches 1:1 ratio
    overageRate: 0.05, // $0.05 per 1K tokens (4× provider cost, 76% margin)
  },
  business: {
    aiCredits: -1, // Unlimited projects (limited by tokens)
    monthlyCost: 299,
    tokenLimit: 5980000, // 5,980 credits ($299 value) - matches 1:1 ratio
    overageRate: 0.04, // $0.04 per 1K tokens (3× provider cost, 70% margin)
  },
  enterprise: {
    aiCredits: -1, // Unlimited projects (limited by tokens)
    monthlyCost: 899,
    tokenLimit: 17980000, // 17,980 credits ($899 value) - matches 1:1 ratio
    overageRate: 0.03, // $0.03 per 1K tokens (2.5× provider cost, 60% margin)
  },
};

/**
 * Calculate exact cost for AI tokens
 */
export function calculateTokenCost(
  inputTokens: number, 
  outputTokens: number, 
  model: 'claude' | 'gemini' = 'claude'  // Add model parameter with default
): number {
  const pricing = model === 'gemini' ? GEMINI_PRICING : ANTHROPIC_PRICING;
  const inputCost = (inputTokens / 1_000_000) * pricing.INPUT_COST_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.OUTPUT_COST_PER_1M;
  return parseFloat((inputCost + outputCost).toFixed(4));
}

/**
 * Calculate storage cost based on bytes used
 */
export function calculateStorageCost(bytes: number): number {
  const gb = bytes / STORAGE_PRICING.BYTES_PER_GB;
  return parseFloat((gb * STORAGE_PRICING.COST_PER_GB_MONTH).toFixed(4));
}

/**
 * Calculate deployment/bandwidth cost based on visits
 */
export function calculateDeploymentCost(visits: number): number {
  const thousands = visits / 1000;
  return parseFloat((thousands * DEPLOYMENT_PRICING.COST_PER_1K_VISITS).toFixed(4));
}

/**
 * Calculate compute cost based on milliseconds
 */
export function calculateComputeCost(milliseconds: number): number {
  const hours = milliseconds / (1000 * 60 * 60);
  return parseFloat((hours * COMPUTE_PRICING.COST_PER_HOUR).toFixed(6));
}

/**
 * Calculate request cost based on request count
 */
export function calculateRequestCost(requestCount: number): number {
  const millions = requestCount / 1_000_000;
  return parseFloat((millions * REQUEST_PRICING.COST_PER_1M_REQUESTS).toFixed(6));
}

/**
 * Calculate data transfer cost based on bytes
 */
export function calculateDataTransferCost(bytes: number): number {
  const gib = bytes / DATA_TRANSFER_PRICING.BYTES_PER_GIB;
  return parseFloat((gib * DATA_TRANSFER_PRICING.COST_PER_GIB).toFixed(6));
}

/**
 * Track AI usage and calculate costs (with compute time tracking)
 * Supports dual-path billing: plan (counts against limit) vs premium (always overage)
 */
export async function trackAIUsage(params: {
  userId: string;
  projectId: string | null;
  type: "ai_generation" | "ai_chat" | "lomu_chat" | "architect_consultation";
  inputTokens: number;
  outputTokens: number;
  computeTimeMs?: number; // Optional compute time in milliseconds
  model?: 'claude' | 'gemini'; // Model used for pricing
  billingMode?: 'plan' | 'premium'; // plan = counts against limit, premium = always overage
  metadata?: any;
}): Promise<{ success: boolean; cost: number; error?: string }> {
  const { userId, projectId, type, inputTokens, outputTokens, computeTimeMs, model = 'claude', billingMode = 'plan', metadata } = params;

  try {
    const totalTokens = inputTokens + outputTokens;
    const tokenCost = calculateTokenCost(inputTokens, outputTokens, model);
    const computeCost = computeTimeMs ? calculateComputeCost(computeTimeMs) : 0;
    const totalCost = tokenCost + computeCost;

    // Always include cost breakdown in metadata, even if no metadata is provided
    const enrichedMetadata = {
      ...(metadata || {}),
      computeTimeMs: computeTimeMs || 0,
      computeCost,
      tokenCost,
      totalCost,
      billingMode,
    };

    // Log the usage
    await db.insert(usageLogs).values({
      userId,
      projectId,
      type,
      inputTokens,
      outputTokens,
      totalTokens,
      cost: totalCost.toString(),
      metadata: JSON.stringify(enrichedMetadata),
    });

    // Update monthly usage
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    await updateMonthlyUsage(userId, currentMonth, totalCost, totalTokens, billingMode);

    return { success: true, cost: totalCost };
  } catch (error: any) {
    console.error("Error tracking AI usage:", error);
    return { success: false, cost: 0, error: error.message };
  }
}

/**
 * Track API request for billing
 */
export async function trackAPIRequest(params: {
  userId: string;
  endpoint: string;
  method: string;
  responseSize?: number; // bytes
}): Promise<{ success: boolean; cost: number }> {
  const { userId, endpoint, method, responseSize } = params;

  try {
    const requestCost = calculateRequestCost(1); // Cost for 1 request
    const transferCost = responseSize ? calculateDataTransferCost(responseSize) : 0;
    const totalCost = requestCost + transferCost;

    // Log the usage
    await db.insert(usageLogs).values({
      userId,
      projectId: null,
      type: "api_request" as any,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: totalCost.toString(),
      metadata: JSON.stringify({
        endpoint,
        method,
        responseSize,
        requestCost,
        transferCost,
      }),
    });

    return { success: true, cost: totalCost };
  } catch (error: any) {
    console.error("Error tracking API request:", error);
    return { success: false, cost: 0 };
  }
}

/**
 * Update monthly usage aggregates
 * Supports dual-path billing: plan vs premium
 */
async function updateMonthlyUsage(userId: string, month: string, aiCost: number, tokens: number, billingMode: 'plan' | 'premium' = 'plan') {
  // Get user's current subscription to determine plan limit
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  const userPlan = subscription[0]?.plan || "free";
  const planLimits = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS];
  const planMonthlyCost = planLimits?.monthlyCost || 0;

  const existing = await db
    .select()
    .from(monthlyUsage)
    .where(and(eq(monthlyUsage.userId, userId), eq(monthlyUsage.month, month)))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    const current = existing[0];
    
    let updateData: any = {
      updatedAt: new Date(),
    };

    // BUG FIX 2: Only increment tokensUsed for plan mode, NEVER for premium
    if (billingMode === 'premium') {
      // Premium billing: Add to premiumAICost (I AM Architect consultations)
      // Premium tokens DO NOT count toward plan limit
      const newPremiumCost = parseFloat(current.premiumAICost || "0") + aiCost;
      updateData.premiumAICost = newPremiumCost.toFixed(2);
      updateData.totalTokens = current.totalTokens + tokens;
      // CRITICAL: Do NOT set updateData.tokensUsed here - premium doesn't count toward limit
    } else {
      // Plan billing: Add to regular AI cost and count tokens toward limit
      const newAICost = parseFloat(current.totalAICost) + aiCost;
      updateData.aiProjectsCount = current.aiProjectsCount + 1;
      updateData.totalTokens = current.totalTokens + tokens;
      updateData.tokensUsed = current.tokensUsed + tokens; // Counts toward plan limit
      updateData.totalAICost = newAICost.toFixed(2);
    }

    // BUG FIX 1: Recalculate total cost with ALL components including premium
    // Formula: totalCost = totalAICost + premiumAICost + infraCost + storageCost + deploymentCost
    const newAICost = billingMode === 'plan' 
      ? parseFloat(current.totalAICost) + aiCost 
      : parseFloat(current.totalAICost);
    const newPremiumCost = billingMode === 'premium'
      ? parseFloat(current.premiumAICost || "0") + aiCost
      : parseFloat(current.premiumAICost || "0");
    const infraCost = parseFloat(current.infraCost);
    const storageCost = parseFloat(current.storageCost || "0");
    const deploymentCost = parseFloat(current.deploymentCost || "0");
    // CRITICAL: Include BOTH plan AI costs AND premium AI costs in total
    const newTotalCost = newAICost + newPremiumCost + infraCost + storageCost + deploymentCost;
    
    // Calculate overage based on plan limits
    const tokensUsedForLimit = billingMode === 'plan' ? current.tokensUsed + tokens : current.tokensUsed;
    let overage = 0;
    
    if (planLimits.tokenLimit !== -1 && tokensUsedForLimit > planLimits.tokenLimit) {
      // User exceeded plan token limit, calculate overage cost
      const overageTokens = tokensUsedForLimit - planLimits.tokenLimit;
      const overageCost = (overageTokens / 1000) * planLimits.overageRate;
      overage = overageCost + newPremiumCost; // Premium is always overage
    } else {
      overage = newPremiumCost; // Only premium if within plan limits
    }

    updateData.totalCost = newTotalCost.toFixed(2);
    updateData.planLimit = planMonthlyCost.toFixed(2);
    updateData.overage = overage.toFixed(2);

    await db
      .update(monthlyUsage)
      .set(updateData)
      .where(eq(monthlyUsage.id, current.id));
  } else {
    // Create new monthly record
    const infraCost = 8.50; // Base infrastructure cost per month
    const aiCostRegular = billingMode === 'plan' ? aiCost : 0;
    const premiumCost = billingMode === 'premium' ? aiCost : 0;
    const storageCost = 0; // New records start with 0 storage
    const deploymentCost = 0; // New records start with 0 deployment
    
    // BUG FIX 1: Ensure totalCost includes ALL components (plan + premium + infra + storage + deployment)
    // Formula: totalCost = totalAICost + premiumAICost + infraCost + storageCost + deploymentCost
    const totalCost = aiCostRegular + premiumCost + infraCost + storageCost + deploymentCost;
    
    // Calculate overage for new record
    let overage = 0;
    if (billingMode === 'premium') {
      overage = premiumCost; // Premium is always overage
    } else if (planLimits.tokenLimit !== -1 && tokens > planLimits.tokenLimit) {
      const overageTokens = tokens - planLimits.tokenLimit;
      overage = (overageTokens / 1000) * planLimits.overageRate;
    }

    // BUG FIX 2: Only set tokensUsed for plan mode (premium tokens don't count toward limit)
    await db.insert(monthlyUsage).values({
      userId,
      month,
      aiProjectsCount: billingMode === 'plan' ? 1 : 0,
      totalTokens: tokens,
      tokensUsed: billingMode === 'plan' ? tokens : 0, // CRITICAL: Only plan tokens count toward limit
      totalAICost: aiCostRegular.toFixed(2),
      premiumAICost: premiumCost.toFixed(2),
      storageBytesUsed: 0,
      storageCost: storageCost.toFixed(2),
      deploymentsCount: 0,
      deploymentVisits: 0,
      deploymentCost: deploymentCost.toFixed(2),
      infraCost: infraCost.toFixed(2),
      totalCost: totalCost.toFixed(2), // Includes BOTH plan and premium costs
      planLimit: planMonthlyCost.toFixed(2),
      overage: overage.toFixed(2),
    });
  }
}

/**
 * Update user storage usage and costs
 */
export async function updateStorageUsage(userId: string): Promise<void> {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Calculate total storage used by user (all files content)
    const files = await db.query.files.findMany({
      where: (files, { eq }) => eq(files.userId, userId),
    });
    
    let totalBytes = files.reduce((sum, file) => {
      return sum + (file.content?.length || 0);
    }, 0);
    
    // CRITICAL: Also include version snapshot files (stored separately)
    // Get all project versions for this user
    const versions = await db.query.projectVersions.findMany({
      where: (projectVersions, { eq }) => eq(projectVersions.userId, userId),
    });
    
    // For each version, get its files and add to total storage
    for (const version of versions) {
      const versionFiles = await db.query.projectVersionFiles.findMany({
        where: (projectVersionFiles, { eq }) => eq(projectVersionFiles.versionId, version.id),
      });
      
      const versionBytes = versionFiles.reduce((sum, file) => {
        return sum + (file.content?.length || 0);
      }, 0);
      
      totalBytes += versionBytes;
    }
    
    const storageCost = calculateStorageCost(totalBytes);
    
    // Get user's plan to calculate overage
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    
    const userPlan = subscription[0]?.plan || "free";
    const planMonthlyCost = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS]?.monthlyCost || 0;
    
    // Get current monthly usage
    const existing = await db
      .select()
      .from(monthlyUsage)
      .where(and(eq(monthlyUsage.userId, userId), eq(monthlyUsage.month, currentMonth)))
      .limit(1);
    
    if (existing.length > 0) {
      const current = existing[0];
      const aiCost = parseFloat(current.totalAICost);
      const premiumCost = parseFloat(current.premiumAICost || "0");
      const infraCost = parseFloat(current.infraCost);
      const deploymentCost = parseFloat(current.deploymentCost || "0");
      const totalCost = aiCost + premiumCost + infraCost + storageCost + deploymentCost;
      const overage = Math.max(0, totalCost - planMonthlyCost);
      
      await db
        .update(monthlyUsage)
        .set({
          storageBytesUsed: totalBytes,
          storageCost: storageCost.toFixed(2),
          totalCost: totalCost.toFixed(2),
          overage: overage.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(monthlyUsage.id, current.id));
    } else {
      // Create new monthly record with storage costs
      const infraCost = 8.50;
      const totalCost = infraCost + storageCost;
      const overage = Math.max(0, totalCost - planMonthlyCost);
      
      await db.insert(monthlyUsage).values({
        userId,
        month: currentMonth,
        aiProjectsCount: 0,
        totalTokens: 0,
        tokensUsed: 0,
        totalAICost: "0.00",
        premiumAICost: "0.00",
        storageBytesUsed: totalBytes,
        storageCost: storageCost.toFixed(2),
        deploymentsCount: 0,
        deploymentVisits: 0,
        deploymentCost: "0.00",
        infraCost: infraCost.toFixed(2),
        totalCost: totalCost.toFixed(2),
        planLimit: planMonthlyCost.toFixed(2),
        overage: overage.toFixed(2),
      });
    }
  } catch (error) {
    console.error("Error updating storage usage:", error);
  }
}

/**
 * Update deployment usage and costs
 */
export async function updateDeploymentUsage(userId: string): Promise<void> {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Get all active deployments for user
    const deployments = await db.query.deployments.findMany({
      where: (deployments, { and, eq }) => 
        and(
          eq(deployments.userId, userId),
          eq(deployments.status, "active")
        ),
    });
    
    const totalVisits = deployments.reduce((sum, d) => sum + (d.monthlyVisits || 0), 0);
    const deploymentCost = calculateDeploymentCost(totalVisits);
    
    // Get user's plan to calculate overage
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    
    const userPlan = subscription[0]?.plan || "free";
    const planMonthlyCost = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS]?.monthlyCost || 0;
    
    // Get current monthly usage
    const existing = await db
      .select()
      .from(monthlyUsage)
      .where(and(eq(monthlyUsage.userId, userId), eq(monthlyUsage.month, currentMonth)))
      .limit(1);
    
    if (existing.length > 0) {
      const current = existing[0];
      const aiCost = parseFloat(current.totalAICost);
      const premiumCost = parseFloat(current.premiumAICost || "0");
      const infraCost = parseFloat(current.infraCost);
      const storageCost = parseFloat(current.storageCost || "0");
      const totalCost = aiCost + premiumCost + infraCost + storageCost + deploymentCost;
      const overage = Math.max(0, totalCost - planMonthlyCost);
      
      await db
        .update(monthlyUsage)
        .set({
          deploymentsCount: deployments.length,
          deploymentVisits: totalVisits,
          deploymentCost: deploymentCost.toFixed(2),
          totalCost: totalCost.toFixed(2),
          overage: overage.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(monthlyUsage.id, current.id));
    } else {
      // Create new monthly record with deployment costs
      const infraCost = 8.50;
      const totalCost = infraCost + deploymentCost;
      const overage = Math.max(0, totalCost - planMonthlyCost);
      
      await db.insert(monthlyUsage).values({
        userId,
        month: currentMonth,
        aiProjectsCount: 0,
        totalTokens: 0,
        tokensUsed: 0,
        totalAICost: "0.00",
        premiumAICost: "0.00",
        storageBytesUsed: 0,
        storageCost: "0.00",
        deploymentsCount: deployments.length,
        deploymentVisits: totalVisits,
        deploymentCost: deploymentCost.toFixed(2),
        infraCost: infraCost.toFixed(2),
        totalCost: totalCost.toFixed(2),
        planLimit: planMonthlyCost.toFixed(2),
        overage: overage.toFixed(2),
      });
    }
  } catch (error) {
    console.error("Error updating deployment usage:", error);
  }
}

/**
 * Check if user can make AI request (within limits)
 * V3.0: Hard limits with payment enforcement
 */
export async function checkUsageLimits(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  creditsRemaining?: number;
  tokensUsed?: number;
  tokenLimit?: number;
  requiresUpgrade?: boolean;
  requiresPayment?: boolean;
  trialExpired?: boolean;
}> {
  try {
    // Check if user is admin - admins have UNLIMITED access to everything
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length > 0 && user[0].role === "admin") {
      return {
        allowed: true,
        creditsRemaining: 999999, // Unlimited for display
        tokensUsed: 0,
        tokenLimit: 999999999, // Unlimited
      };
    }

    // Get user's subscription
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (subscription.length === 0) {
      // No subscription - create free tier by default
      await db.insert(subscriptions).values({
        userId,
        plan: "free",
        status: "active",
        aiCreditsRemaining: PLAN_LIMITS.free.aiCredits,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days free trial
      });

      return {
        allowed: true,
        creditsRemaining: PLAN_LIMITS.free.aiCredits,
        tokensUsed: 0,
        tokenLimit: PLAN_LIMITS.free.tokenLimit,
      };
    }

    const sub = subscription[0];
    const planLimits = PLAN_LIMITS[sub.plan as keyof typeof PLAN_LIMITS];

    // Check free trial expiration (30 days)
    if (sub.plan === "free") {
      const trialEnd = new Date(sub.currentPeriodEnd);
      const now = new Date();
      if (now > trialEnd) {
        return {
          allowed: false,
          reason: "Your free trial has expired. Please upgrade to continue using AI features.",
          requiresUpgrade: true,
          trialExpired: true,
          tokensUsed: 0,
          tokenLimit: planLimits.tokenLimit,
        };
      }
    }

    // Check token limits (monthly)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usage = await db
      .select()
      .from(monthlyUsage)
      .where(and(eq(monthlyUsage.userId, userId), eq(monthlyUsage.month, currentMonth)))
      .limit(1);

    const tokensUsed = usage.length > 0 ? usage[0].totalTokens : 0;

    // HARD LIMIT ENFORCEMENT
    if (planLimits.tokenLimit !== -1 && tokensUsed >= planLimits.tokenLimit) {
      // Free tier: No overages allowed - must upgrade
      if (sub.plan === "free") {
        return {
          allowed: false,
          reason: `Free tier limit reached. You've used ${tokensUsed.toLocaleString()} of ${planLimits.tokenLimit.toLocaleString()} tokens. Please upgrade to continue.`,
          requiresUpgrade: true,
          tokensUsed,
          tokenLimit: planLimits.tokenLimit,
        };
      }

      // Paid tier: Check if they have payment method on file
      const hasPaymentMethod = !!sub.stripeCustomerId;
      
      if (!hasPaymentMethod) {
        return {
          allowed: false,
          reason: `Monthly token limit reached. You've used ${tokensUsed.toLocaleString()} of ${planLimits.tokenLimit.toLocaleString()} tokens. Add a payment method to enable overage billing at $${planLimits.overageRate}/1K tokens.`,
          requiresPayment: true,
          tokensUsed,
          tokenLimit: planLimits.tokenLimit,
        };
      }

      // Has payment method - allow overages with auto-billing
      // (Usage tracking will handle the billing)
    }

    return {
      allowed: true,
      creditsRemaining: sub.aiCreditsRemaining,
      tokensUsed,
      tokenLimit: planLimits.tokenLimit,
    };
  } catch (error: any) {
    console.error("Error checking usage limits:", error);
    return { allowed: false, reason: "Error checking limits" };
  }
}

/**
 * Decrement AI credits after successful generation
 */
export async function decrementAICredits(userId: string): Promise<void> {
  try {
    // Get user's subscription to check if they have unlimited credits
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (subscription.length === 0) {
      return; // No subscription, nothing to decrement
    }

    const userPlan = subscription[0].plan;
    const planLimits = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS];

    // Don't decrement credits for unlimited plans (enterprise)
    if (planLimits.aiCredits === -1) {
      return; // Unlimited credits, no decrement needed
    }

    // Decrement credits for limited plans
    await db
      .update(subscriptions)
      .set({
        aiCreditsRemaining: sql`${subscriptions.aiCreditsRemaining} - 1`,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId));
  } catch (error) {
    console.error("Error decrementing AI credits:", error);
  }
}

/**
 * Get user's current usage stats
 */
export async function getUserUsageStats(userId: string) {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [subscription, usage] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1),
    db
      .select()
      .from(monthlyUsage)
      .where(and(eq(monthlyUsage.userId, userId), eq(monthlyUsage.month, currentMonth)))
      .limit(1),
  ]);

  const sub = subscription[0] || null;
  const monthlyStats = usage[0] || null;
  const planLimits = sub ? PLAN_LIMITS[sub.plan as keyof typeof PLAN_LIMITS] : PLAN_LIMITS.free;

  return {
    subscription: sub,
    plan: sub?.plan || "free",
    aiCreditsRemaining: sub?.aiCreditsRemaining || 0,
    aiCreditsTotal: planLimits.aiCredits,
    tokensUsed: monthlyStats?.totalTokens || 0,
    tokenLimit: planLimits.tokenLimit,
    totalAICost: monthlyStats?.totalAICost || "0.00",
    totalCost: monthlyStats?.totalCost || "0.00",
    projectsThisMonth: monthlyStats?.aiProjectsCount || 0,
  };
}
