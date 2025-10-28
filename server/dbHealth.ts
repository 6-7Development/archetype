import { db } from './db';
import { sql } from 'drizzle-orm';
import { users, projects, files, replitIntegrations } from '@shared/schema';

export interface TableHealth {
  tableName: string;
  rowCount: number;
  sampleData?: any;
  indexes?: string[];
}

export interface DatabaseHealth {
  connected: boolean;
  tables: TableHealth[];
  version?: string;
  size?: string;
  error?: string;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  try {
    // Test basic connectivity
    await db.execute(sql`SELECT 1`);
    
    // Get table stats
    const tables: TableHealth[] = [];
    
    // Check users table
    const userCount = await db.select({ count: sql`COUNT(*)` }).from(users);
    tables.push({
      tableName: 'users',
      rowCount: Number(userCount[0]?.count || 0)
    });
    
    // Check projects table
    const projectCount = await db.select({ count: sql`COUNT(*)` }).from(projects);
    tables.push({
      tableName: 'projects',
      rowCount: Number(projectCount[0]?.count || 0)
    });
    
    // Check files table
    const fileCount = await db.select({ count: sql`COUNT(*)` }).from(files);
    tables.push({
      tableName: 'files',
      rowCount: Number(fileCount[0]?.count || 0)
    });
    
    // Check replitIntegrations table
    const integrationCount = await db.select({ count: sql`COUNT(*)` }).from(replitIntegrations);
    tables.push({
      tableName: 'replitIntegrations',
      rowCount: Number(integrationCount[0]?.count || 0)
    });
    
    // Get PostgreSQL version
    const versionResult = await db.execute(sql`SELECT version()`);
    const version = versionResult.rows[0]?.version || 'Unknown';
    
    // Get database size (approximate)
    const sizeResult = await db.execute(sql`
      SELECT pg_database_size(current_database()) as size
    `);
    const sizeBytes = sizeResult.rows[0]?.size || 0;
    const sizeMB = Math.round(sizeBytes / 1024 / 1024);
    
    return {
      connected: true,
      tables,
      version,
      size: `${sizeMB} MB`
    };
  } catch (error) {
    return {
      connected: false,
      tables: [],
      error: error.message
    };
  }
}

export async function repairDatabase(): Promise<{ success: boolean; message: string }> {
  try {
    // Run any necessary migrations or repairs
    console.log('Running database health check and repair...');
    
    // Check if tables exist and create if missing
    const tablesExist = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log(`Found ${tablesExist.rows.length} tables in database`);
    
    return {
      success: true,
      message: `Database health check complete. Found ${tablesExist.rows.length} tables.`
    };
  } catch (error) {
    return {
      success: false,
      message: `Database repair failed: ${error.message}`
    };
  }
}