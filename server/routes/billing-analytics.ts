/**
 * ENTERPRISE PHASE 7: Billing Analytics Routes
 */

import type { Express, Request, Response } from 'express';
import { billingAnalyticsService } from '../services/billingAnalyticsService';
import { extractTeamContext } from '../middleware/teamScoping';

export function registerBillingAnalyticsRoutes(app: Express) {
  // Record daily analytics
  app.post('/api/billing/daily-analytics', extractTeamContext, async (req: any, res) => {
    const context = req.teamContext;
    const { creditsUsed, activeUsers, aiRequests, deployments } = req.body;

    try {
      const result = await billingAnalyticsService.recordDailyAnalytics(
        context.workspaceId,
        creditsUsed,
        activeUsers,
        aiRequests,
        deployments
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get monthly report
  app.get('/api/billing/monthly-report', extractTeamContext, async (req: any, res) => {
    const context = req.teamContext;
    const { month } = req.query;

    try {
      const report = await billingAnalyticsService.getMonthlyReport(context.workspaceId, month as string);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get spend forecast
  app.get('/api/billing/forecast', extractTeamContext, async (req: any, res) => {
    const context = req.teamContext;
    const { months } = req.query;

    try {
      const forecast = await billingAnalyticsService.forecastSpend(
        context.workspaceId,
        months ? parseInt(months as string) : 3
      );
      res.json({ forecast });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get feature usage breakdown
  app.get('/api/billing/feature-breakdown', extractTeamContext, async (req: any, res) => {
    const context = req.teamContext;

    try {
      const breakdown = await billingAnalyticsService.getFeatureBreakdown(context.workspaceId);
      res.json(breakdown);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
