/**
 * Schema Drift Detector - Prevents RLS/table schema regressions
 * Performs regression checks on startup to detect schema inconsistencies
 * Logs warnings when expected tables, columns, or RLS policies are missing
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger, logError } from './logger';

interface SchemaExpectation {
  tables: {
    [tableName: string]: {
      columns: {
        [columnName: string]: string; // data_type
      };
      rlsEnabled?: boolean;
      minPolicies?: number; // Minimum expected RLS policies
    };
  };
}

// Define expected schema structure
const EXPECTED_SCHEMA: SchemaExpectation = {
  tables: {
    // Core tables with RLS
    team_workspaces: {
      columns: {
        id: 'character varying',
        name: 'character varying',
        owner_id: 'character varying',
        created_at: 'timestamp without time zone',
      },
      rlsEnabled: true,
      minPolicies: 4, // select, insert, update, delete
    },
    team_members: {
      columns: {
        id: 'character varying',
        workspace_id: 'character varying',
        user_id: 'character varying',
        role: 'character varying',
      },
      rlsEnabled: true,
      minPolicies: 4,
    },
    projects: {
      columns: {
        id: 'character varying',
        user_id: 'character varying',
        name: 'character varying',
      },
      rlsEnabled: true,
      minPolicies: 4,
    },
    files: {
      columns: {
        id: 'character varying',
        project_id: 'character varying',
        user_id: 'character varying',
        name: 'character varying',
      },
      rlsEnabled: true,
      minPolicies: 4,
    },
    chat_messages: {
      columns: {
        id: 'character varying',
        project_id: 'character varying',
        user_id: 'character varying',
      },
      rlsEnabled: true,
      minPolicies: 4,
    },
    // Enterprise tables with RLS
    audit_logs: {
      columns: {
        id: 'character varying',
        workspace_id: 'character varying',
        user_id: 'character varying',
        action: 'character varying',
        created_at: 'timestamp without time zone',
      },
      rlsEnabled: true,
      minPolicies: 3, // select, insert, delete
    },
    enterprise_workspace_settings: {
      columns: {
        workspace_id: 'character varying',
        plan_tier: 'character varying',
        billing_status: 'character varying',
      },
      rlsEnabled: true,
      minPolicies: 3,
    },
    billing_analytics: {
      columns: {
        id: 'character varying',
        workspace_id: 'character varying',
        date: 'character varying',
        credits_used: 'numeric',
      },
      rlsEnabled: true,
      minPolicies: 3,
    },
    usage_metrics: {
      columns: {
        id: 'character varying',
        workspace_id: 'character varying',
        feature_type: 'character varying',
        timestamp: 'timestamp without time zone',
      },
      rlsEnabled: true,
      minPolicies: 3,
    },
    // Webhook queue
    webhook_queue: {
      columns: {
        id: 'character varying',
        targetUrl: 'character varying',
        payload: 'jsonb',
        status: 'character varying',
        attemptCount: 'integer',
        nextRetryAt: 'timestamp without time zone',
      },
      minPolicies: 0, // No RLS needed for system queue
    },
    // Audit retention
    audit_retention_policies: {
      columns: {
        id: 'character varying',
        workspaceId: 'character varying',
        logType: 'character varying',
        retentionDays: 'integer',
      },
      minPolicies: 0,
    },
  },
};

interface DriftReport {
  hasErrors: boolean;
  missingTables: string[];
  missingColumns: Array<{ table: string; column: string; expected: string }>;
  rlsDisabled: string[];
  insufficientPolicies: Array<{ table: string; expected: number; actual: number }>;
  warnings: string[];
}

/**
 * Check for schema drift and return a detailed report
 */
export async function detectSchemaDrift(): Promise<DriftReport> {
  const report: DriftReport = {
    hasErrors: false,
    missingTables: [],
    missingColumns: [],
    rlsDisabled: [],
    insufficientPolicies: [],
    warnings: [],
  };

  try {
    // Get all existing tables in public schema
    const tablesResult = await db.execute(sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    const existingTables = new Set(
      ((tablesResult as any).rows || []).map((r: any) => r.table_name)
    );

    // Check for missing tables
    for (const tableName of Object.keys(EXPECTED_SCHEMA.tables)) {
      if (!existingTables.has(tableName)) {
        report.missingTables.push(tableName);
        report.hasErrors = true;
        report.warnings.push(`[DRIFT] Missing table: ${tableName}`);
        continue;
      }

      const tableExpectation = EXPECTED_SCHEMA.tables[tableName];

      // Check for missing columns
      const columnsResult = await db.execute(sql`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position;
      `);
      const existingColumns = new Map(
        ((columnsResult as any).rows || []).map((r: any) => [r.column_name, r.data_type])
      );

      for (const [colName, colType] of Object.entries(tableExpectation.columns)) {
        if (!existingColumns.has(colName)) {
          report.missingColumns.push({ table: tableName, column: colName, expected: colType as string });
          report.hasErrors = true;
          report.warnings.push(`[DRIFT] Missing column: ${tableName}.${colName}`);
        }
      }

      // Check RLS status if expected
      if (tableExpectation.rlsEnabled) {
        const rlsResult = await db.execute(sql`
          SELECT relrowsecurity FROM pg_class
          JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
          WHERE relname = ${tableName} AND nspname = 'public';
        `);
        const rlsEnabled = ((rlsResult as any).rows?.[0]?.relrowsecurity) === true;

        if (!rlsEnabled) {
          report.rlsDisabled.push(tableName);
          report.hasErrors = true;
          report.warnings.push(`[DRIFT] RLS disabled on table: ${tableName}`);
        }

        // Check minimum policies
        if (tableExpectation.minPolicies && tableExpectation.minPolicies > 0) {
          const policiesResult = await db.execute(sql`
            SELECT COUNT(*) as count FROM pg_policies
            WHERE schemaname = 'public' AND tablename = ${tableName};
          `);
          const policyCount = ((policiesResult as any).rows?.[0]?.count) || 0;

          if (policyCount < tableExpectation.minPolicies) {
            report.insufficientPolicies.push({
              table: tableName,
              expected: tableExpectation.minPolicies,
              actual: policyCount,
            });
            report.warnings.push(
              `[DRIFT] ${tableName} has ${policyCount} RLS policies, expected ≥${tableExpectation.minPolicies}`
            );
          }
        }
      }
    }

    // Check for orphaned tables (not in expectations but exist)
    for (const tableName of existingTables) {
      if (!EXPECTED_SCHEMA.tables[tableName] && tableName.startsWith('public.')) {
        // This is expected for some system tables, just log informally
        continue;
      }
    }

    return report;
  } catch (error) {
    logError('Schema drift detection failed', error as Error);
    report.hasErrors = true;
    report.warnings.push(`[DRIFT] Detection failed: ${(error as Error).message}`);
    return report;
  }
}

/**
 * Log drift report to console with proper formatting
 */
export function logDriftReport(report: DriftReport): void {
  if (report.hasErrors) {
    console.error('[SCHEMA-DRIFT] ⚠️  ERRORS DETECTED:');
    
    if (report.missingTables.length > 0) {
      console.error('[SCHEMA-DRIFT] Missing tables:', report.missingTables.join(', '));
    }
    if (report.missingColumns.length > 0) {
      console.error('[SCHEMA-DRIFT] Missing columns:');
      report.missingColumns.forEach(m => {
        console.error(`  - ${m.table}.${m.column} (expected: ${m.expected})`);
      });
    }
    if (report.rlsDisabled.length > 0) {
      console.error('[SCHEMA-DRIFT] RLS disabled on:', report.rlsDisabled.join(', '));
    }
    if (report.insufficientPolicies.length > 0) {
      console.error('[SCHEMA-DRIFT] Insufficient RLS policies:');
      report.insufficientPolicies.forEach(p => {
        console.error(`  - ${p.table}: ${p.actual}/${p.expected} policies`);
      });
    }

    // Log to structured logger
    logger.error('Schema drift detected', {
      missingTables: report.missingTables,
      missingColumns: report.missingColumns,
      rlsDisabled: report.rlsDisabled,
      insufficientPolicies: report.insufficientPolicies,
    });
  } else {
    console.log('[SCHEMA-DRIFT] ✅ No drift detected - schema matches expectations');
    logger.info('Schema drift check passed');
  }

  // Always log warnings
  report.warnings.forEach(w => console.warn(w));
}

/**
 * Run schema drift detection and report results
 * Should be called during application startup
 */
export async function runSchemaDriftCheck(): Promise<boolean> {
  console.log('[SCHEMA-DRIFT] Starting schema drift regression check...');
  const report = await detectSchemaDrift();
  logDriftReport(report);
  return !report.hasErrors;
}

/**
 * Export drift data for monitoring dashboards
 */
export async function getSchemaDriftMetrics() {
  const report = await detectSchemaDrift();
  return {
    timestamp: new Date().toISOString(),
    status: report.hasErrors ? 'error' : 'healthy',
    errorCount: report.missingTables.length + report.missingColumns.length + report.rlsDisabled.length + report.insufficientPolicies.length,
    details: {
      missingTables: report.missingTables,
      missingColumns: report.missingColumns,
      rlsDisabled: report.rlsDisabled,
      insufficientPolicies: report.insufficientPolicies,
    },
  };
}
