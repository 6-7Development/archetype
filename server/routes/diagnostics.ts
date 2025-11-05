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

// Platform healing activity log - shows what the AI has done
router.get('/api/diagnostics/activity', requireAdmin, async (req, res) => {
  try {
    // Fetch recent platform healing sessions with their outcomes
    const sessions = await db.execute(sql`
      SELECT 
        id,
        incident_id,
        phase,
        status,
        diagnosis_notes,
        proposed_fix,
        files_changed,
        verification_passed,
        commit_hash,
        deployment_status,
        ai_strategy,
        error,
        started_at,
        completed_at
      FROM platform_healing_sessions
      ORDER BY started_at DESC
      LIMIT 50
    `);

    // Fetch recent open incidents
    const incidents = await db.execute(sql`
      SELECT 
        id,
        type,
        severity,
        title,
        description,
        status,
        created_at,
        resolved_at
      FROM platform_incidents
      WHERE status != 'resolved'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    // Format activity log entries
    const activityLog = [];

    // Add recent incidents
    for (const incident of incidents.rows) {
      activityLog.push({
        timestamp: incident.created_at,
        type: 'incident_detected',
        severity: incident.severity || 'medium',
        title: incident.title || `${incident.type} Issue`,
        message: incident.description || 'Platform issue detected',
        status: incident.status,
        action: incident.status === 'open' ? 'Investigation in progress...' : 'Being resolved'
      });
    }

    // Add healing session results
    for (const session of sessions.rows) {
      const filesChanged = session.files_changed ? JSON.parse(session.files_changed as string) : [];
      const fileCount = filesChanged.length;

      if (session.status === 'completed' && session.verification_passed) {
        activityLog.push({
          timestamp: session.completed_at || session.started_at,
          type: 'fix_applied',
          severity: 'success',
          title: `✅ Fix Applied Successfully`,
          message: session.proposed_fix || 'Platform issue resolved',
          details: {
            strategy: session.ai_strategy === 'architect' ? 'I AM Architect (Claude Sonnet 4)' : 'LomuAI',
            filesModified: fileCount,
            commitHash: session.commit_hash,
            deploymentStatus: session.deployment_status
          },
          action: session.commit_hash ? `Committed to GitHub (${String(session.commit_hash).substring(0, 7)})` : 'Changes applied'
        });
      } else if (session.status === 'failed' || session.error) {
        activityLog.push({
          timestamp: session.completed_at || session.started_at,
          type: 'fix_failed',
          severity: 'error',
          title: `❌ Fix Attempt Failed`,
          message: session.error || 'Unable to resolve issue automatically',
          details: {
            strategy: session.ai_strategy === 'architect' ? 'I AM Architect' : 'LomuAI',
            phase: session.phase
          },
          action: 'Manual intervention may be required'
        });
      } else if (session.status === 'in_progress') {
        activityLog.push({
          timestamp: session.started_at,
          type: 'fix_in_progress',
          severity: 'info',
          title: `🔧 Working on Fix...`,
          message: session.diagnosis_notes || 'AI is analyzing and fixing the issue',
          details: {
            strategy: session.ai_strategy === 'architect' ? 'I AM Architect' : 'LomuAI',
            phase: session.phase
          },
          action: 'In progress...'
        });
      }
    }

    // Sort by timestamp descending
    activityLog.sort((a, b) => new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime());

    res.json({
      timestamp: new Date().toISOString(),
      totalActivities: activityLog.length,
      openIncidents: incidents.rows.length,
      recentSessions: sessions.rows.length,
      activities: activityLog.slice(0, 30) // Return last 30 activities
    });
  } catch (error: any) {
    console.error('[DIAGNOSTICS] Activity log error:', error);
    res.status(500).json({ 
      error: 'Failed to load activity log',
      message: error.message 
    });
  }
});

export { router as diagnosticsRouter };