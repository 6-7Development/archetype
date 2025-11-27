/**
 * ENTERPRISE PHASE 4: Team Billing Service
 * Manages team credit allocation, usage metering, and billing settings
 */

import { db } from '../db';
import { teamBillingContact, teams } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class TeamBillingService {
  /**
   * Get team billing contact
   */
  static async getTeamBillingContact(teamId: string) {
    try {
      const result = await db
        .select()
        .from(teamBillingContact)
        .where(eq(teamBillingContact.teamId, teamId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('[TEAM-BILLING] Error fetching billing contact:', error);
      return null;
    }
  }

  /**
   * Get team credit balance
   */
  static async getTeamCreditBalance(teamId: string): Promise<number> {
    try {
      const billing = await this.getTeamBillingContact(teamId);
      return billing ? parseFloat(billing.creditBalance || '0') : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Deduct credits from team
   * Returns: success status
   */
  static async deductTeamCredits(
    teamId: string,
    amount: number,
    reason: string
  ): Promise<boolean> {
    try {
      const billing = await this.getTeamBillingContact(teamId);
      if (!billing) {
        console.error(`[TEAM-BILLING] No billing contact for team ${teamId}`);
        return false;
      }

      const newBalance = parseFloat(billing.creditBalance || '0') - amount;

      // Check monthly budget
      if (billing.monthlyBudget && newBalance < 0) {
        console.warn(`[TEAM-BILLING] Team ${teamId} exceeded budget - balance: ${newBalance}`);
        return false;
      }

      await db
        .update(teamBillingContact)
        .set({
          creditBalance: newBalance.toString(),
          updatedAt: new Date(),
        })
        .where(eq(teamBillingContact.teamId, teamId));

      console.log(
        `✅ [TEAM-BILLING] Deducted ${amount} credits from team ${teamId} (${reason}) - New balance: ${newBalance}`
      );

      return true;
    } catch (error) {
      console.error('[TEAM-BILLING] Error deducting credits:', error);
      return false;
    }
  }

  /**
   * Add credits to team
   */
  static async addTeamCredits(teamId: string, amount: number, reason: string): Promise<boolean> {
    try {
      const billing = await this.getTeamBillingContact(teamId);
      if (!billing) {
        console.error(`[TEAM-BILLING] No billing contact for team ${teamId}`);
        return false;
      }

      const newBalance = parseFloat(billing.creditBalance || '0') + amount;

      await db
        .update(teamBillingContact)
        .set({
          creditBalance: newBalance.toString(),
          updatedAt: new Date(),
        })
        .where(eq(teamBillingContact.teamId, teamId));

      console.log(
        `✅ [TEAM-BILLING] Added ${amount} credits to team ${teamId} (${reason}) - New balance: ${newBalance}`
      );

      return true;
    } catch (error) {
      console.error('[TEAM-BILLING] Error adding credits:', error);
      return false;
    }
  }

  /**
   * Check if team has sufficient credits
   */
  static async hasEnoughCredits(teamId: string, requiredAmount: number): Promise<boolean> {
    try {
      const balance = await this.getTeamCreditBalance(teamId);
      return balance >= requiredAmount;
    } catch {
      return false;
    }
  }

  /**
   * Get team billing summary
   */
  static async getTeamBillingSummary(teamId: string) {
    try {
      const billing = await this.getTeamBillingContact(teamId);
      const team = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      if (!billing || !team) {
        return null;
      }

      return {
        teamName: team[0].name,
        planTier: team[0].planTier,
        creditBalance: parseFloat(billing.creditBalance || '0'),
        monthlyBudget: billing.monthlyBudget ? parseFloat(billing.monthlyBudget) : null,
        autoRecharge: billing.autoRecharge,
        autoRechargeAmount: billing.autoRechargeAmount
          ? parseFloat(billing.autoRechargeAmount)
          : null,
        billingEmail: billing.billingEmail,
      };
    } catch (error) {
      console.error('[TEAM-BILLING] Error getting summary:', error);
      return null;
    }
  }
}

export const teamBillingService = new TeamBillingService();
