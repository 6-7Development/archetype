/**
 * ENTERPRISE PHASE 4: Team Billing Service
 * Manages team credit allocation, usage metering, and billing settings
 */

import { db } from '../db';
import { enterpriseWorkspaceSettings, teamWorkspaces } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class TeamBillingService {
  /**
   * Get workspace billing settings
   */
  static async getWorkspaceBillingSettings(workspaceId: string) {
    try {
      const result = await db
        .select()
        .from(enterpriseWorkspaceSettings)
        .where(eq(enterpriseWorkspaceSettings.workspaceId, workspaceId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('[TEAM-BILLING] Error fetching billing settings:', error);
      return null;
    }
  }

  /**
   * Get workspace credit balance
   */
  static async getWorkspaceCreditBalance(workspaceId: string): Promise<number> {
    try {
      const billing = await this.getWorkspaceBillingSettings(workspaceId);
      return billing ? parseFloat(billing.creditBalance || '0') : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Deduct credits from workspace (GAP #4 FIX)
   */
  static async deductWorkspaceCredits(
    workspaceId: string,
    amount: number,
    reason: string
  ): Promise<boolean> {
    try {
      const billing = await this.getWorkspaceBillingSettings(workspaceId);
      if (!billing) {
        console.error(`[TEAM-BILLING] No billing for workspace ${workspaceId}`);
        return false;
      }

      const newBalance = parseFloat(billing.creditBalance || '0') - amount;

      // Check monthly budget
      if (billing.monthlyBudget && newBalance < 0) {
        console.warn(`[TEAM-BILLING] Workspace ${workspaceId} exceeded budget - balance: ${newBalance}`);
        return false;
      }

      await db
        .update(enterpriseWorkspaceSettings)
        .set({
          creditBalance: newBalance.toString(),
          updatedAt: new Date(),
        })
        .where(eq(enterpriseWorkspaceSettings.workspaceId, workspaceId));

      console.log(
        `✅ [TEAM-BILLING] Deducted ${amount} credits from workspace ${workspaceId} (${reason}) - New balance: ${newBalance}`
      );

      return true;
    } catch (error) {
      console.error('[TEAM-BILLING] Error deducting credits:', error);
      return false;
    }
  }

  /**
   * Add credits to workspace
   */
  static async addWorkspaceCredits(workspaceId: string, amount: number, reason: string): Promise<boolean> {
    try {
      const billing = await this.getWorkspaceBillingSettings(workspaceId);
      if (!billing) {
        console.error(`[TEAM-BILLING] No billing for workspace ${workspaceId}`);
        return false;
      }

      const newBalance = parseFloat(billing.creditBalance || '0') + amount;

      await db
        .update(enterpriseWorkspaceSettings)
        .set({
          creditBalance: newBalance.toString(),
          updatedAt: new Date(),
        })
        .where(eq(enterpriseWorkspaceSettings.workspaceId, workspaceId));

      console.log(
        `✅ [TEAM-BILLING] Added ${amount} credits to workspace ${workspaceId} (${reason}) - New balance: ${newBalance}`
      );

      return true;
    } catch (error) {
      console.error('[TEAM-BILLING] Error adding credits:', error);
      return false;
    }
  }

  /**
   * Check if workspace has sufficient credits
   */
  static async hasEnoughCredits(workspaceId: string, requiredAmount: number): Promise<boolean> {
    try {
      const balance = await this.getWorkspaceCreditBalance(workspaceId);
      return balance >= requiredAmount;
    } catch {
      return false;
    }
  }

  /**
   * Get workspace billing summary (GAP #4 FIX)
   */
  static async getWorkspaceBillingSummary(workspaceId: string) {
    try {
      const billing = await this.getWorkspaceBillingSettings(workspaceId);
      const workspace = await db
        .select()
        .from(teamWorkspaces)
        .where(eq(teamWorkspaces.id, workspaceId))
        .limit(1);

      if (!billing || !workspace) {
        return null;
      }

      return {
        workspaceName: workspace[0].name,
        planTier: billing.planTier,
        creditBalance: parseFloat(billing.creditBalance || '0'),
        monthlyBudget: billing.monthlyBudget ? parseFloat(billing.monthlyBudget) : null,
        autoRecharge: billing.autoRecharge,
        autoRechargeAmount: billing.autoRechargeAmount
          ? parseFloat(billing.autoRechargeAmount)
          : null,
        billingEmail: billing.billingEmail,
        billingStatus: billing.billingStatus,
      };
    } catch (error) {
      console.error('[TEAM-BILLING] Error getting summary:', error);
      return null;
    }
  }
}

export const teamBillingService = new TeamBillingService();
