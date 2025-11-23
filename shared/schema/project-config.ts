/**
 * Project Configuration Schema
 * Each project has its own CRITICAL/SENSITIVE/EDITABLE protection tiers
 * Users can customize which files/settings are protected
 */

import { pgTable, text, jsonb, timestamp, boolean, serial } from 'drizzle-orm/pg-core';

export const projectConfigs = pgTable('project_configs', {
  id: serial('id').primaryKey(),
  projectId: text('project_id').notNull().unique(),
  ownerId: text('owner_id').notNull(),

  // Custom app configuration for this project
  customConfig: jsonb('custom_config').default({}), // Merged with defaults

  // Protection settings - what's critical, sensitive, editable
  protectionSettings: jsonb('protection_settings').default({
    critical: [],    // Paths that cannot be modified
    sensitive: [],   // Paths that require approval
    editable: [],    // Paths that can be freely modified
  }),

  // Files that LomuAI cannot modify without approval
  protectedFiles: jsonb('protected_files').default([
    'src/index.ts',
    'src/main.tsx',
    'package.json',
    'tsconfig.json',
    '.env',
  ]),

  // Approval settings for this project
  requireApprovalFor: jsonb('require_approval_for').default([
    'DELETE_FILE',
    'DELETE_FOLDER',
    'MODIFY_PACKAGE_JSON',
    'MODIFY_ENV',
    'MODIFY_CONFIG_FILE',
    'DATABASE_MIGRATION',
    'ENVIRONMENT_VAR_CHANGE',
  ]),

  // Auto-approve settings
  autoApproveRules: jsonb('auto_approve_rules').default({
    nonCriticalFiles: false,      // Auto-approve changes to non-critical files
    documentationOnly: false,      // Auto-approve docs changes
    whitelist: [],                 // Auto-approve changes from these LomuAI instances
  }),

  // Email settings for this project
  emailNotifications: boolean('email_notifications').default(true),
  approvalEmailAddresses: jsonb('approval_email_addresses').default([]), // Additional approvers

  // Audit trail for this project
  auditTrail: jsonb('audit_trail').default([]), // Full change history

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const projectApprovals = pgTable('project_approvals', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  requestedBy: text('requested_by').notNull(),

  operation: text('operation').notNull(), // DELETE_FILE, MODIFY_FILE, etc.
  filePath: text('file_path'),
  description: text('description').notNull(),
  reason: text('reason'),

  changeBefore: jsonb('change_before'),
  changeAfter: jsonb('change_after'),

  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).default('pending'),
  approvedBy: text('approved_by'),
  approvalReason: text('approval_reason'),

  createdAt: timestamp('created_at').defaultNow(),
  respondedAt: timestamp('responded_at'),
});

export type ProjectConfig = typeof projectConfigs.$inferSelect;
export type ProjectConfigInsert = typeof projectConfigs.$inferInsert;
export type ProjectApproval = typeof projectApprovals.$inferSelect;
export type ProjectApprovalInsert = typeof projectApprovals.$inferInsert;
