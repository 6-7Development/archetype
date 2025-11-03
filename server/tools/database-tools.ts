/**
 * Database tools for Lomu AI
 * Database creation, status checks, and SQL execution
 */

import { db, pool } from '../db';
import { sql } from 'drizzle-orm';
import { checkDatabaseHealth, type DatabaseHealth } from '../dbHealth';

export interface DatabaseStatusResult {
  connected: boolean;
  version?: string;
  size?: string;
  tables: number;
  message: string;
  details?: DatabaseHealth;
}

export interface SqlExecutionResult {
  success: boolean;
  rows?: any[];
  rowCount?: number;
  error?: string;
  executionTime?: number;
}

export interface DatabaseCreationResult {
  success: boolean;
  message: string;
  connectionString?: string;
  error?: string;
}

/**
 * Check database connection status
 * Verifies database connectivity and returns health info
 */
export async function checkDatabaseStatus(): Promise<DatabaseStatusResult> {
  try {
    const startTime = Date.now();
    const health = await checkDatabaseHealth();
    const executionTime = Date.now() - startTime;
    
    if (!health.connected) {
      return {
        connected: false,
        tables: 0,
        message: `Database connection failed: ${health.error || 'Unknown error'}`,
        details: health,
      };
    }
    
    return {
      connected: true,
      version: health.version,
      size: health.size,
      tables: health.tables.length,
      message: `✓ Database is healthy (${executionTime}ms)`,
      details: health,
    };
  } catch (error: any) {
    console.error('[CHECK-DATABASE-STATUS] Error:', error);
    return {
      connected: false,
      tables: 0,
      message: `Database check failed: ${error.message}`,
    };
  }
}

/**
 * Execute SQL query on development database
 * IMPORTANT: Only works on development database for safety
 */
export async function executeSql(params: {
  sql_query: string;
  environment?: 'development';
}): Promise<SqlExecutionResult> {
  const { sql_query, environment = 'development' } = params;
  
  // Safety check: Only allow development database
  if (environment !== 'development') {
    return {
      success: false,
      error: 'SQL execution is only allowed on development database for safety',
    };
  }
  
  // Block destructive operations without explicit confirmation
  const destructiveKeywords = ['DROP', 'TRUNCATE', 'DELETE FROM', 'UPDATE'];
  const isDestructive = destructiveKeywords.some(keyword => 
    sql_query.toUpperCase().includes(keyword)
  );
  
  if (isDestructive && !sql_query.includes('-- CONFIRMED')) {
    return {
      success: false,
      error: 'Destructive SQL requires explicit confirmation. Add "-- CONFIRMED" comment to proceed.',
    };
  }
  
  try {
    const startTime = Date.now();
    // Use sql.raw() to execute the actual SQL query string
    const result = await db.execute(sql.raw(sql_query));
    const executionTime = Date.now() - startTime;
    
    return {
      success: true,
      rows: result.rows,
      rowCount: result.rows.length,
      executionTime,
    };
  } catch (error: any) {
    console.error('[EXECUTE-SQL] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Create PostgreSQL database
 * Note: Database is typically provisioned by platform, this returns connection info
 */
export async function createPostgresqlDatabase(): Promise<DatabaseCreationResult> {
  try {
    // Check if DATABASE_URL is already configured
    if (!process.env.DATABASE_URL) {
      return {
        success: false,
        message: 'No DATABASE_URL found. Please provision a database through your platform.',
        error: 'DATABASE_URL environment variable is not set',
      };
    }
    
    // Verify connection works
    const health = await checkDatabaseHealth();
    
    if (!health.connected) {
      return {
        success: false,
        message: 'Database exists but connection failed',
        error: health.error,
      };
    }
    
    return {
      success: true,
      message: 'Database is already configured and connected',
      connectionString: 'DATABASE_URL (configured)',
    };
  } catch (error: any) {
    console.error('[CREATE-POSTGRESQL-DATABASE] Error:', error);
    return {
      success: false,
      message: 'Database creation check failed',
      error: error.message,
    };
  }
}
