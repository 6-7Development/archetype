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
    const [users] = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const [sessions] = await db.execute(sql`SELECT COUNT(*) as count FROM sessions`);
    const [projects] = await db.execute(sql`SELECT COUNT(*) as count FROM projects`);

    result.tables.users = Number(users.count);
    result.tables.sessions = Number(sessions.count);
    result.tables.projects = Number(projects.count);

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