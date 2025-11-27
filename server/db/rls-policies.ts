/**
 * Row-Level Security (RLS) Policies for Multi-Tenant Isolation
 * 
 * Enforces workspace-scoped data access at the database level.
 * Session variable 'app.workspace_id' must be set before executing queries.
 * 
 * Tables covered:
 * 1. team_workspaces - Users can only see workspaces they're members of
 * 2. team_members - Scoped by workspace_id
 * 3. projects - Scoped by workspace via team_projects association
 * 4. files - Scoped by workspace via project association
 * 5. chat_messages - Scoped by workspace via project association
 * 6. audit_logs - Scoped directly by workspace_id
 * 7. enterprise_workspace_settings - Scoped directly by workspace_id (primary key)
 * 8. billing_analytics - Scoped directly by workspace_id
 * 9. usage_metrics - Scoped directly by workspace_id
 */

import { sql } from "drizzle-orm";
import { db } from "../db";

const RLS_POLICIES = [
  // ============================================================================
  // 1. team_workspaces - Users can only access workspaces they're members of
  // ============================================================================
  sql`
    ALTER TABLE team_workspaces ENABLE ROW LEVEL SECURITY;
  `,
  sql`
    DROP POLICY IF EXISTS rls_team_workspaces_select ON team_workspaces;
  `,
  sql`
    CREATE POLICY rls_team_workspaces_select ON team_workspaces
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.workspace_id = team_workspaces.id
        AND team_members.user_id = current_setting('app.user_id')
      )
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_team_workspaces_insert ON team_workspaces;
  `,
  sql`
    CREATE POLICY rls_team_workspaces_insert ON team_workspaces
    FOR INSERT
    WITH CHECK (
      owner_id = current_setting('app.user_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_team_workspaces_update ON team_workspaces;
  `,
  sql`
    CREATE POLICY rls_team_workspaces_update ON team_workspaces
    FOR UPDATE
    USING (
      owner_id = current_setting('app.user_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_team_workspaces_delete ON team_workspaces;
  `,
  sql`
    CREATE POLICY rls_team_workspaces_delete ON team_workspaces
    FOR DELETE
    USING (
      owner_id = current_setting('app.user_id')
    );
  `,

  // ============================================================================
  // 2. team_members - Scoped by workspace
  // ============================================================================
  sql`
    ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
  `,
  sql`
    DROP POLICY IF EXISTS rls_team_members_select ON team_members;
  `,
  sql`
    CREATE POLICY rls_team_members_select ON team_members
    FOR SELECT
    USING (
      workspace_id = current_setting('app.workspace_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_team_members_insert ON team_members;
  `,
  sql`
    CREATE POLICY rls_team_members_insert ON team_members
    FOR INSERT
    WITH CHECK (
      workspace_id = current_setting('app.workspace_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_team_members_update ON team_members;
  `,
  sql`
    CREATE POLICY rls_team_members_update ON team_members
    FOR UPDATE
    USING (
      workspace_id = current_setting('app.workspace_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_team_members_delete ON team_members;
  `,
  sql`
    CREATE POLICY rls_team_members_delete ON team_members
    FOR DELETE
    USING (
      workspace_id = current_setting('app.workspace_id')
    );
  `,

  // ============================================================================
  // 3. projects - Scoped by workspace via team_projects association
  // ============================================================================
  sql`
    ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
  `,
  sql`
    DROP POLICY IF EXISTS rls_projects_select ON projects;
  `,
  sql`
    CREATE POLICY rls_projects_select ON projects
    FOR SELECT
    USING (
      -- Personal projects belong to the user
      user_id = current_setting('app.user_id')
      OR
      -- OR project is associated with current workspace
      EXISTS (
        SELECT 1 FROM team_projects
        WHERE team_projects.project_id = projects.id
        AND team_projects.workspace_id = current_setting('app.workspace_id')::uuid
      )
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_projects_insert ON projects;
  `,
  sql`
    CREATE POLICY rls_projects_insert ON projects
    FOR INSERT
    WITH CHECK (
      user_id = current_setting('app.user_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_projects_update ON projects;
  `,
  sql`
    CREATE POLICY rls_projects_update ON projects
    FOR UPDATE
    USING (
      user_id = current_setting('app.user_id')
      OR
      EXISTS (
        SELECT 1 FROM team_projects
        WHERE team_projects.project_id = projects.id
        AND team_projects.workspace_id = current_setting('app.workspace_id')::uuid
      )
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_projects_delete ON projects;
  `,
  sql`
    CREATE POLICY rls_projects_delete ON projects
    FOR DELETE
    USING (
      user_id = current_setting('app.user_id')
    );
  `,

  // ============================================================================
  // 4. files - Scoped by workspace via project association
  // ============================================================================
  sql`
    ALTER TABLE files ENABLE ROW LEVEL SECURITY;
  `,
  sql`
    DROP POLICY IF EXISTS rls_files_select ON files;
  `,
  sql`
    CREATE POLICY rls_files_select ON files
    FOR SELECT
    USING (
      -- Files belong to user's personal projects
      user_id = current_setting('app.user_id')
      OR
      -- OR file is in a project associated with current workspace
      EXISTS (
        SELECT 1 FROM projects p
        JOIN team_projects tp ON tp.project_id = p.id
        WHERE p.id = files.project_id
        AND tp.workspace_id = current_setting('app.workspace_id')::uuid
      )
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_files_insert ON files;
  `,
  sql`
    CREATE POLICY rls_files_insert ON files
    FOR INSERT
    WITH CHECK (
      user_id = current_setting('app.user_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_files_update ON files;
  `,
  sql`
    CREATE POLICY rls_files_update ON files
    FOR UPDATE
    USING (
      user_id = current_setting('app.user_id')
      OR
      EXISTS (
        SELECT 1 FROM projects p
        JOIN team_projects tp ON tp.project_id = p.id
        WHERE p.id = files.project_id
        AND tp.workspace_id = current_setting('app.workspace_id')::uuid
      )
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_files_delete ON files;
  `,
  sql`
    CREATE POLICY rls_files_delete ON files
    FOR DELETE
    USING (
      user_id = current_setting('app.user_id')
    );
  `,

  // ============================================================================
  // 5. chat_messages - Scoped by workspace via project association
  // ============================================================================
  sql`
    ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
  `,
  sql`
    DROP POLICY IF EXISTS rls_chat_messages_select ON chat_messages;
  `,
  sql`
    CREATE POLICY rls_chat_messages_select ON chat_messages
    FOR SELECT
    USING (
      -- Messages from user's personal chats
      user_id = current_setting('app.user_id')
      OR
      -- OR message is in a project associated with current workspace
      EXISTS (
        SELECT 1 FROM projects p
        JOIN team_projects tp ON tp.project_id = p.id
        WHERE p.id = chat_messages.project_id
        AND tp.workspace_id = current_setting('app.workspace_id')::uuid
      )
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_chat_messages_insert ON chat_messages;
  `,
  sql`
    CREATE POLICY rls_chat_messages_insert ON chat_messages
    FOR INSERT
    WITH CHECK (
      user_id = current_setting('app.user_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_chat_messages_update ON chat_messages;
  `,
  sql`
    CREATE POLICY rls_chat_messages_update ON chat_messages
    FOR UPDATE
    USING (
      user_id = current_setting('app.user_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_chat_messages_delete ON chat_messages;
  `,
  sql`
    CREATE POLICY rls_chat_messages_delete ON chat_messages
    FOR DELETE
    USING (
      user_id = current_setting('app.user_id')
    );
  `,

  // ============================================================================
  // 6. audit_logs - Scoped directly by workspace_id
  // ============================================================================
  sql`
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
  `,
  sql`
    DROP POLICY IF EXISTS rls_audit_logs_select ON audit_logs;
  `,
  sql`
    CREATE POLICY rls_audit_logs_select ON audit_logs
    FOR SELECT
    USING (
      workspace_id = current_setting('app.workspace_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_audit_logs_insert ON audit_logs;
  `,
  sql`
    CREATE POLICY rls_audit_logs_insert ON audit_logs
    FOR INSERT
    WITH CHECK (
      workspace_id = current_setting('app.workspace_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_audit_logs_delete ON audit_logs;
  `,
  sql`
    CREATE POLICY rls_audit_logs_delete ON audit_logs
    FOR DELETE
    USING (
      workspace_id = current_setting('app.workspace_id')
    );
  `,

  // ============================================================================
  // 7. enterprise_workspace_settings - Scoped directly by workspace_id (primary key)
  // ============================================================================
  sql`
    ALTER TABLE enterprise_workspace_settings ENABLE ROW LEVEL SECURITY;
  `,
  sql`
    DROP POLICY IF EXISTS rls_enterprise_workspace_settings_select ON enterprise_workspace_settings;
  `,
  sql`
    CREATE POLICY rls_enterprise_workspace_settings_select ON enterprise_workspace_settings
    FOR SELECT
    USING (
      workspace_id = current_setting('app.workspace_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_enterprise_workspace_settings_update ON enterprise_workspace_settings;
  `,
  sql`
    CREATE POLICY rls_enterprise_workspace_settings_update ON enterprise_workspace_settings
    FOR UPDATE
    USING (
      workspace_id = current_setting('app.workspace_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_enterprise_workspace_settings_insert ON enterprise_workspace_settings;
  `,
  sql`
    CREATE POLICY rls_enterprise_workspace_settings_insert ON enterprise_workspace_settings
    FOR INSERT
    WITH CHECK (
      workspace_id = current_setting('app.workspace_id')
    );
  `,

  // ============================================================================
  // 8. billing_analytics - Scoped directly by workspace_id
  // ============================================================================
  sql`
    ALTER TABLE billing_analytics ENABLE ROW LEVEL SECURITY;
  `,
  sql`
    DROP POLICY IF EXISTS rls_billing_analytics_select ON billing_analytics;
  `,
  sql`
    CREATE POLICY rls_billing_analytics_select ON billing_analytics
    FOR SELECT
    USING (
      workspace_id = current_setting('app.workspace_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_billing_analytics_insert ON billing_analytics;
  `,
  sql`
    CREATE POLICY rls_billing_analytics_insert ON billing_analytics
    FOR INSERT
    WITH CHECK (
      workspace_id = current_setting('app.workspace_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_billing_analytics_delete ON billing_analytics;
  `,
  sql`
    CREATE POLICY rls_billing_analytics_delete ON billing_analytics
    FOR DELETE
    USING (
      workspace_id = current_setting('app.workspace_id')
    );
  `,

  // ============================================================================
  // 9. usage_metrics - Scoped directly by workspace_id
  // ============================================================================
  sql`
    ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
  `,
  sql`
    DROP POLICY IF EXISTS rls_usage_metrics_select ON usage_metrics;
  `,
  sql`
    CREATE POLICY rls_usage_metrics_select ON usage_metrics
    FOR SELECT
    USING (
      workspace_id = current_setting('app.workspace_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_usage_metrics_insert ON usage_metrics;
  `,
  sql`
    CREATE POLICY rls_usage_metrics_insert ON usage_metrics
    FOR INSERT
    WITH CHECK (
      workspace_id = current_setting('app.workspace_id')
    );
  `,
  sql`
    DROP POLICY IF EXISTS rls_usage_metrics_delete ON usage_metrics;
  `,
  sql`
    CREATE POLICY rls_usage_metrics_delete ON usage_metrics
    FOR DELETE
    USING (
      workspace_id = current_setting('app.workspace_id')
    );
  `,
];

/**
 * Initialize all RLS policies on application startup
 * Should be called once during database initialization
 */
export async function initializeRLSPolicies() {
  try {
    console.log('[RLS] Starting RLS policy initialization...');

    for (const policy of RLS_POLICIES) {
      try {
        await db.execute(policy);
      } catch (error: any) {
        // Log but don't fail - some policies might already exist
        if (!error.message?.includes('already exists')) {
          console.warn('[RLS] Policy error:', error.message);
        }
      }
    }

    // Verify policies were created
    const result = await db.execute(sql`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename IN (
        'team_workspaces',
        'team_members',
        'projects',
        'files',
        'chat_messages',
        'audit_logs',
        'enterprise_workspace_settings',
        'billing_analytics',
        'usage_metrics'
      )
      ORDER BY tablename, policyname;
    `);

    const policies = (result as any).rows || [];
    
    console.log(`[RLS] ✅ Successfully initialized RLS policies`);
    console.log(`[RLS] Active policies: ${policies.length}`);
    
    if (policies.length > 0) {
      const policyMap = new Map<string, number>();
      policies.forEach((p: any) => {
        const count = policyMap.get(p.tablename) || 0;
        policyMap.set(p.tablename, count + 1);
      });

      console.log('[RLS] Policy summary by table:');
      policyMap.forEach((count, table) => {
        console.log(`  - ${table}: ${count} policies`);
      });
    }

    return {
      success: true,
      totalPolicies: policies.length,
      policiesByTable: Array.from(
        new Map<string, number>(
          policies.map((p: any) => [
            p.tablename,
            (new Map(
              policies.map((x: any) => [x.tablename, 0])
            ).get(p.tablename) || 0) + 1
          ])
        )
      ).map(([table, count]) => ({ table, count }))
    };
  } catch (error: any) {
    console.error('[RLS] Failed to initialize RLS policies:', error.message);
    throw error;
  }
}

/**
 * Verify RLS is enabled on a table
 */
export async function verifyRLSEnabled(tableName: string) {
  try {
    const result = await db.execute(sql`
      SELECT rowsecurity FROM pg_class
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE relname = ${tableName}
      AND nspname = 'public';
    `);

    const row = (result as any).rows?.[0];
    return row?.rowsecurity === true;
  } catch (error) {
    console.error(`[RLS] Failed to verify RLS for ${tableName}:`, error);
    return false;
  }
}

/**
 * List all active RLS policies
 */
export async function listActivePolicies() {
  try {
    const result = await db.execute(sql`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);

    return (result as any).rows || [];
  } catch (error) {
    console.error('[RLS] Failed to list policies:', error);
    return [];
  }
}
