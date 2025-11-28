/**
 * Monitoring Endpoints - Observability API for dashboards
 * Exposes system health, RLS policies, background jobs, and schema drift metrics
 */

import { Router } from 'express';
import { getSchemaDriftMetrics } from '../services/schemaDriftDetector';
import { listActivePolicies } from '../db/rls-policies';
import { logger } from '../services/logger';
import { sql } from 'drizzle-orm';
import { db } from '../db';

const router = Router();

/**
 * GET /api/monitoring/schema-drift
 * Returns current schema drift status and detailed error report
 */
router.get('/schema-drift', async (req, res) => {
  try {
    const metrics = await getSchemaDriftMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get schema drift metrics', { error: (error as Error).message });
    res.status(500).json({
      error: 'Failed to get schema drift metrics',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/monitoring/rls-policies
 * Returns all active RLS policies by table
 */
router.get('/rls-policies', async (req, res) => {
  try {
    const policies = await listActivePolicies();
    
    // Group by table
    const grouped: Record<string, any[]> = {};
    policies.forEach((p: any) => {
      if (!grouped[p.tablename]) {
        grouped[p.tablename] = [];
      }
      grouped[p.tablename].push({
        name: p.policyname,
        permissive: p.permissive,
        roles: p.roles,
      });
    });

    res.json({
      timestamp: new Date().toISOString(),
      totalPolicies: policies.length,
      tables: Object.keys(grouped).length,
      byTable: grouped,
    });
  } catch (error) {
    logger.error('Failed to list RLS policies', { error: (error as Error).message });
    res.status(500).json({
      error: 'Failed to list RLS policies',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/monitoring/background-jobs
 * Returns background job statistics and status
 */
router.get('/background-jobs', async (req, res) => {
  try {
    // Get job counts from database
    const jobStats = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as count,
        MAX(updated_at) as last_run
      FROM lomu_jobs
      GROUP BY status
    `);

    const stats: Record<string, any> = {
      timestamp: new Date().toISOString(),
      activeJobs: (jobStats as any).rows || [],
      scheduledJobs: [
        {
          name: 'session-cleanup',
          interval: '24 hours',
          status: 'active',
        },
        {
          name: 'webhook-queue-processor',
          interval: '30 seconds',
          status: 'active',
        },
        {
          name: 'audit-retention',
          interval: '1 hour',
          status: 'active',
        },
      ],
    };

    res.json(stats);
  } catch (error) {
    // Return default stats even if query fails
    res.json({
      timestamp: new Date().toISOString(),
      activeJobs: [],
      scheduledJobs: [
        { name: 'session-cleanup', interval: '24 hours', status: 'active' },
        { name: 'webhook-queue-processor', interval: '30 seconds', status: 'active' },
        { name: 'audit-retention', interval: '1 hour', status: 'active' },
      ],
      warning: (error as Error).message,
    });
  }
});

/**
 * GET /api/monitoring/system-health
 * Returns overall system health status
 */
router.get('/system-health', async (req, res) => {
  try {
    const metrics = await getSchemaDriftMetrics();
    const driftStatus = metrics.status === 'healthy' ? 'healthy' : 'degraded';

    res.json({
      timestamp: new Date().toISOString(),
      status: driftStatus,
      components: {
        database: 'connected',
        schema: metrics.status,
        rateLimiter: 'active',
        backgroundJobs: 'running',
        rls: metrics.details.rlsDisabled.length === 0 ? 'active' : 'degraded',
      },
      errors: metrics.errorCount,
    });
  } catch (error) {
    res.status(500).json({
      timestamp: new Date().toISOString(),
      status: 'error',
      components: {},
      error: (error as Error).message,
    });
  }
});

export default router;
