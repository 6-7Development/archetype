/**
 * ENTERPRISE PHASE 6: Compliance Routes
 */

import type { Express, Request, Response } from 'express';
import { complianceService } from '../services/complianceService';
import { extractTeamContext } from '../middleware/teamScoping';
import { auditService } from '../services/auditService';

export function registerComplianceRoutes(app: Express) {
  // Run compliance checks
  app.post('/api/compliance/check', extractTeamContext, async (req: any, res) => {
    const context = req.teamContext;
    try {
      const results = await complianceService.runComplianceChecks(context.workspaceId);
      await auditService.log({
        workspaceId: context.workspaceId,
        userId: req.authenticatedUserId,
        action: 'compliance.check_run',
        resourceType: 'compliance',
        changesAfter: results,
        status: 'success',
      });
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get compliance status
  app.get('/api/compliance/status', extractTeamContext, async (req: any, res) => {
    const context = req.teamContext;
    try {
      const status = await complianceService.getComplianceStatus(context.workspaceId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Set data retention policy
  app.post('/api/compliance/retention', extractTeamContext, async (req: any, res) => {
    const context = req.teamContext;
    const { dataType, retentionDays, autoDelete } = req.body;

    try {
      const result = await complianceService.setRetentionPolicy(
        context.workspaceId,
        dataType,
        retentionDays,
        autoDelete
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Configure encryption
  app.post('/api/compliance/encryption', extractTeamContext, async (req: any, res) => {
    const context = req.teamContext;
    const { tlsVersion, complianceLevel, keyRotationDays } = req.body;

    try {
      const result = await complianceService.configureEncryption(context.workspaceId, {
        tlsVersion,
        complianceLevel,
        keyRotationDays,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
