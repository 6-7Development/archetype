import { Router, Request, Response, NextFunction } from 'express';
import { runPlatformDiagnostics } from '../diagnostics.ts';
import { db } from '../db.ts';
import { sql } from 'drizzle-orm';

// Admin middleware - checks if user is admin
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

const router = Router();

router.get('/api/diagnostics/health', async (req, res) => {
  try {
    const results = await runPlatformDiagnostics();
    const hasErrors = results.some(r => r.status === 'error');
    const hasWarnings = results.some(r => r.status === 'warning');
    
    res.status(hasErrors ? 503 : 200).json({
      status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy',
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to run diagnostics',
      error: (error as Error).message
    });
  }
});

// User-friendly platform diagnostics for debugging
router.get('/api/diagnostics/platform', requireAdmin, async (req, res) => {
  try {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      database: {
        status: 'unknown',
        message: '',
        details: {}
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      },
      issues: []
    };

    // Test database connection
    try {
      const result = await db.execute(sql`SELECT NOW() as current_time, version() as db_version`);
      const dbInfo: any = result.rows[0];
      
      diagnostics.database.status = 'connected';
      diagnostics.database.message = 'Database is healthy and responding normally';
      diagnostics.database.details = {
        serverTime: dbInfo.current_time,
        version: dbInfo.db_version,
        connectionPool: 'Active',
        latency: 'Normal'
      };
    } catch (error: any) {
      diagnostics.database.status = 'error';
      diagnostics.database.message = `Database connection problem: ${error.message}`;
      diagnostics.issues.push({
        severity: 'critical',
        component: 'Database Connection',
        message: `Cannot connect to the database. ${error.message}`,
        suggestion: 'Check your DATABASE_URL environment variable and network connection.'
      });
    }

    // Check table counts
    try {
      const tableChecks = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as count FROM users`),
        db.execute(sql`SELECT COUNT(*) as count FROM projects`),
        db.execute(sql`SELECT COUNT(*) as count FROM healing_targets`),
      ]);

      diagnostics.database.details.userCount = Number(tableChecks[0].rows[0]?.count || 0);
      diagnostics.database.details.projectCount = Number(tableChecks[1].rows[0]?.count || 0);
      diagnostics.database.details.healingTargetCount = Number(tableChecks[2].rows[0]?.count || 0);
    } catch (error: any) {
      diagnostics.issues.push({
        severity: 'warning',
        component: 'Database Tables',
        message: `Some database tables may not exist yet: ${error.message}`,
        suggestion: 'Run database migrations or push schema changes.'
      });
    }

    // System health
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const memoryPercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);

    if (memoryPercent > 90) {
      diagnostics.issues.push({
        severity: 'warning',
        component: 'Memory Usage',
        message: `Memory usage is high (${memoryPercent}%). Using ${memoryUsedMB}MB of ${memoryTotalMB}MB.`,
        suggestion: 'Consider restarting the application if performance degrades.'
      });
    }

    // Format uptime in human-readable format
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    diagnostics.system.uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;
    diagnostics.system.memoryUsage = `${memoryUsedMB}MB / ${memoryTotalMB}MB (${memoryPercent}%)`;

    // Overall health summary
    const criticalIssues = diagnostics.issues.filter((i: any) => i.severity === 'critical');
    const warningIssues = diagnostics.issues.filter((i: any) => i.severity === 'warning');

    if (criticalIssues.length > 0) {
      diagnostics.overallHealth = 'critical';
      diagnostics.healthMessage = `${criticalIssues.length} critical issue(s) detected`;
    } else if (warningIssues.length > 0) {
      diagnostics.overallHealth = 'warning';
      diagnostics.healthMessage = `${warningIssues.length} warning(s) - system is operational`;
    } else {
      diagnostics.overallHealth = 'healthy';
      diagnostics.healthMessage = 'All systems operational';
    }

    res.json(diagnostics);
  } catch (error: any) {
    console.error('[DIAGNOSTICS] Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate diagnostics',
      message: error.message 
    });
  }
});

export { router as diagnosticsRouter };