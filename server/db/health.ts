import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../logging';

export interface HealthCheckResult {
  database: {
    connected: boolean;
    responseTime: number;
    error?: string;
  };
  tables: {
    users: number;
    sessions: number;
    projects: number;
  };
  timestamp: Date;
}

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const result: HealthCheckResult = {
    database: {
      connected: false,
      responseTime: 0
    },
    tables: {
      users: 0,
      sessions: 0,
      projects: 0
    },
    timestamp: new Date()
  };

  try {
    // Test basic connectivity
    await db.execute(sql`SELECT 1`);
    result.database.connected = true;
    result.database.responseTime = Date.now() - startTime;

    // Count records in main tables
    const usersResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM users`);
    result.tables.users = Number(usersResult.rows[0]?.count ?? 0);

    const sessionsResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM sessions`);
    result.tables.sessions = Number(sessionsResult.rows[0]?.count ?? 0);

    const projectsResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM projects`);
    result.tables.projects = Number(projectsResult.rows[0]?.count ?? 0);

    logger.info('Database health check passed', result);
  } catch (error) {
    result.database.error = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Database health check failed', error);
  }

  return result;
}

// Run periodic health checks
export function startHealthMonitoring(intervalMs: number = 60000) {
  setInterval(async () => {
    await checkDatabaseHealth();
  }, intervalMs);
}