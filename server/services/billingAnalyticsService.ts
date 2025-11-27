/**
 * ENTERPRISE PHASE 7: Billing Analytics Service
 * Daily aggregation, monthly forecasting, usage reporting
 */

import { db } from '../db';
import { billingAnalytics, usageMetrics, enterpriseWorkspaceSettings } from '@shared/schema';
import { eq, gte, lte } from 'drizzle-orm';

export class BillingAnalyticsService {
  /**
   * Record daily usage and aggregate credits
   */
  static async recordDailyAnalytics(
    workspaceId: string,
    creditsUsed: number,
    activeUsers: number,
    aiRequests: number,
    deployments: number
  ) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const settings = await db.select().from(enterpriseWorkspaceSettings).where(eq(enterpriseWorkspaceSettings.workspaceId, workspaceId));

      const creditsRemaining = settings.length > 0 ? (Number(settings[0].creditBalance) - creditsUsed).toString() : '0';

      await db.insert(billingAnalytics).values({
        workspaceId,
        date: today,
        creditsUsed: creditsUsed.toString(),
        creditsRemaining,
        estimatedCost: (creditsUsed * 0.01).toString(), // $0.01 per credit
        activeUsers,
        aiRequests,
        deployments,
      });

      return { success: true };
    } catch (error) {
      console.error('[BILLING-ANALYTICS] Record failed:', error);
      return { error: error instanceof Error ? error.message : 'Failed' };
    }
  }

  /**
   * Get monthly usage report
   */
  static async getMonthlyReport(workspaceId: string, month?: string) {
    try {
      const targetMonth = month || new Date().toISOString().slice(0, 7);
      const startDate = `${targetMonth}-01`;
      const endDate = new Date(`${targetMonth}-01`);
      endDate.setMonth(endDate.getMonth() + 1);
      const endDateStr = endDate.toISOString().split('T')[0];

      const analytics = await db
        .select()
        .from(billingAnalytics)
        .where(eq(billingAnalytics.workspaceId, workspaceId));

      const monthData = analytics.filter((a) => a.date >= startDate && a.date <= endDateStr);

      const totalCredits = monthData.reduce((sum, a) => sum + Number(a.creditsUsed), 0);
      const totalCost = monthData.reduce((sum, a) => sum + Number(a.estimatedCost), 0);
      const avgActiveUsers = Math.ceil(monthData.reduce((sum, a) => sum + a.activeUsers, 0) / monthData.length || 1);

      return {
        month: targetMonth,
        totalCredits,
        totalCost,
        avgActiveUsers,
        totalRequests: monthData.reduce((sum, a) => sum + a.aiRequests, 0),
        totalDeployments: monthData.reduce((sum, a) => sum + a.deployments, 0),
        days: monthData.length,
      };
    } catch (error) {
      console.error('[BILLING-ANALYTICS] Report failed:', error);
      return null;
    }
  }

  /**
   * Forecast next 3 months spend based on trends
   */
  static async forecastSpend(workspaceId: string, months = 3) {
    try {
      const analytics = await db.select().from(billingAnalytics).where(eq(billingAnalytics.workspaceId, workspaceId));

      // Get last 30 days average
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentData = analytics.filter((a) => new Date(a.date) >= thirtyDaysAgo);

      const avgDailySpend = recentData.reduce((sum, a) => sum + Number(a.estimatedCost), 0) / (recentData.length || 1);

      const forecast = [];
      for (let i = 1; i <= months; i++) {
        const forecastDate = new Date();
        forecastDate.setMonth(forecastDate.getMonth() + i);
        const daysInMonth = new Date(forecastDate.getFullYear(), forecastDate.getMonth() + 1, 0).getDate();

        forecast.push({
          month: forecastDate.toISOString().slice(0, 7),
          estimatedCost: Number((avgDailySpend * daysInMonth).toFixed(2)),
          confidence: 0.85,
        });
      }

      return forecast;
    } catch (error) {
      console.error('[BILLING-ANALYTICS] Forecast failed:', error);
      return [];
    }
  }

  /**
   * Get feature usage breakdown
   */
  static async getFeatureBreakdown(workspaceId: string) {
    try {
      const metrics = await db.select().from(usageMetrics).where(eq(usageMetrics.workspaceId, workspaceId));

      const breakdown: Record<string, any> = {};
      metrics.forEach((m) => {
        if (!breakdown[m.featureType]) {
          breakdown[m.featureType] = { count: 0, totalCost: 0 };
        }
        breakdown[m.featureType].count += m.usageCount;
        breakdown[m.featureType].totalCost += Number(m.totalCost);
      });

      return breakdown;
    } catch (error) {
      console.error('[BILLING-ANALYTICS] Breakdown failed:', error);
      return {};
    }
  }
}

export const billingAnalyticsService = new BillingAnalyticsService();
