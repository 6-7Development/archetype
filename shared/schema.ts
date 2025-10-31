import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, jsonb, index, bigint, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export { satisfactionSurveys, insertSatisfactionSurveySchema, type InsertSatisfactionSurvey, type SatisfactionSurvey } from "../shared/satisfactionSchema";

// Session storage table for OAuth authentication
// (IMPORTANT) This table is mandatory for authentication, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for universal authentication
// (IMPORTANT) This table is mandatory for authentication, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(), // Required for login
  password: varchar("password"), // Bcrypt hash - optional (null for OAuth users)
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("user"), // user, admin
  isOwner: boolean("is_owner").notNull().default(false), // Platform owner (can modify platform in production)
  autonomyLevel: varchar("autonomy_level", { length: 20 }).notNull().default("basic"), // 'basic' | 'standard' | 'deep' | 'max' - Controls LomuAI capabilities
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Registration schema (email + password required)
export const registerUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

export type RegisterUser = z.infer<typeof registerUserSchema>;

// Login schema (email + password)
export const loginUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginUser = z.infer<typeof loginUserSchema>;

// Maintenance Mode - Controls platform modification access
export const maintenanceMode = pgTable("maintenance_mode", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: boolean("enabled").notNull().default(false),
  enabledBy: varchar("enabled_by"), // User ID who enabled maintenance mode
  enabledAt: timestamp("enabled_at"),
  reason: text("reason"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMaintenanceModeSchema = createInsertSchema(maintenanceMode).omit({
  id: true,
  updatedAt: true,
});

export type InsertMaintenanceMode = z.infer<typeof insertMaintenanceModeSchema>;
export type MaintenanceMode = typeof maintenanceMode.$inferSelect;

// User Avatar State - Per-user Lumo mascot mood and preferences
export const userAvatarState = pgTable("user_avatar_state", {
  userId: varchar("user_id").primaryKey().notNull(),
  currentMood: varchar("current_mood").notNull().default("happy"), // happy, excited, thinking, working, success, error, annoyed, sad, idle, confused, content, cheerful, love, angry, displeased
  lastMoodChange: timestamp("last_mood_change").notNull().defaultNow(),
  autoMoodEnabled: boolean("auto_mood_enabled").notNull().default(true), // Auto-change based on build status
  customMessage: text("custom_message"), // Optional status message
  particlePreference: varchar("particle_preference").notNull().default("auto"), // auto, minimal, off
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserAvatarStateSchema = createInsertSchema(userAvatarState).omit({
  createdAt: true,
  updatedAt: true,
  lastMoodChange: true,
});

export type InsertUserAvatarState = z.infer<typeof insertUserAvatarStateSchema>;
export type UserAvatarState = typeof userAvatarState.$inferSelect;

// Platform Incidents - Track detected problems that need healing
export const platformIncidents = pgTable("platform_incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Incident details
  type: text("type").notNull(), // 'high_cpu', 'memory_leak', 'build_failure', 'runtime_error', 'lsp_error'
  severity: text("severity").notNull(), // 'low', 'medium', 'high', 'critical'
  title: text("title").notNull(), // "High CPU usage detected"
  description: text("description").notNull(), // Detailed error message
  
  // Detection metadata
  source: text("source").notNull(), // 'metrics', 'logs', 'manual'
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  
  // Status tracking
  status: text("status").notNull().default("open"), // 'open', 'healing', 'resolved', 'failed', 'ignored'
  
  // Healing session link
  healingSessionId: varchar("healing_session_id"), // Link to active healing session
  
  // Metadata for diagnosis
  stackTrace: text("stack_trace"),
  affectedFiles: jsonb("affected_files"), // Array of file paths
  metrics: jsonb("metrics"), // Snapshot of metrics at detection time
  logs: text("logs"), // Relevant log excerpts
  
  // Resolution tracking
  rootCause: text("root_cause"), // Determined root cause
  fixDescription: text("fix_description"), // How it was fixed
  commitHash: varchar("commit_hash"), // Git commit that fixed it
  
  // Retry tracking
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlatformIncidentSchema = createInsertSchema(platformIncidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlatformIncident = z.infer<typeof insertPlatformIncidentSchema>;
export type PlatformIncident = typeof platformIncidents.$inferSelect;

// Platform Healing Sessions - Track ongoing healing processes
export const platformHealingSessions = pgTable("platform_healing_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to incident
  incidentId: varchar("incident_id").notNull(),
  
  // Session metadata
  phase: text("phase").notNull(), // 'diagnosis', 'repair', 'verification', 'commit', 'deploy', 'complete'
  status: text("status").notNull().default("active"), // 'active', 'success', 'failed', 'cancelled'
  
  // Diagnosis data
  diagnosisNotes: text("diagnosis_notes"), // AI's analysis
  proposedFix: text("proposed_fix"), // What AI plans to do
  
  // Files changed
  filesChanged: jsonb("files_changed"), // Array of { path, action, diff }
  
  // Verification results
  verificationResults: jsonb("verification_results"), // Test results, build status, etc.
  verificationPassed: boolean("verification_passed"),
  
  // Git/Deploy tracking
  branchName: varchar("branch_name"), // "fix/incident-12345"
  commitHash: varchar("commit_hash"),
  deploymentId: varchar("deployment_id"),
  deploymentStatus: text("deployment_status"), // 'pending', 'deploying', 'success', 'failed'
  deploymentUrl: text("deployment_url"), // Production deployment URL
  deploymentStartedAt: timestamp("deployment_started_at"),
  deploymentCompletedAt: timestamp("deployment_completed_at"),
  
  // AI metadata
  tokensUsed: integer("tokens_used").default(0),
  model: varchar("model").default("claude-sonnet-4-20250514"),
  
  // Timestamps
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  
  // Error tracking
  error: text("error"),
});

export const insertPlatformHealingSessionSchema = createInsertSchema(platformHealingSessions).omit({
  id: true,
  startedAt: true,
});

export type InsertPlatformHealingSession = z.infer<typeof insertPlatformHealingSessionSchema>;
export type PlatformHealingSession = typeof platformHealingSessions.$inferSelect;

// Platform Heal Attempts - Track individual fix attempts (for retry logic)
export const platformHealAttempts = pgTable("platform_heal_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links
  incidentId: varchar("incident_id").notNull(),
  sessionId: varchar("session_id").notNull(),
  
  // Attempt details
  attemptNumber: integer("attempt_number").notNull(),
  strategy: text("strategy").notNull(), // 'standard', 'alternative', 'rollback'
  
  // What was tried
  actionsTaken: jsonb("actions_taken"), // Array of actions
  filesModified: jsonb("files_modified"),
  
  // Results
  success: boolean("success").notNull(),
  verificationPassed: boolean("verification_passed"),
  error: text("error"),
  
  // Timestamps
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertPlatformHealAttemptSchema = createInsertSchema(platformHealAttempts).omit({
  id: true,
  startedAt: true,
});

export type InsertPlatformHealAttempt = z.infer<typeof insertPlatformHealAttemptSchema>;
export type PlatformHealAttempt = typeof platformHealAttempts.$inferSelect;

// Platform Incident Playbooks - Store learned patterns for automated fixes
export const platformIncidentPlaybooks = pgTable("platform_incident_playbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Pattern matching
  incidentType: text("incident_type").notNull(), // 'high_cpu', 'build_failure', etc.
  pattern: text("pattern").notNull(), // Error pattern to match
  
  // Fix template
  fixTemplate: text("fix_template").notNull(), // AI prompt/instructions
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(), // 0.00-1.00
  
  // Learning metadata
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  
  // Source
  learnedFrom: varchar("learned_from"), // incident ID that created this playbook
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlatformIncidentPlaybookSchema = createInsertSchema(platformIncidentPlaybooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlatformIncidentPlaybook = z.infer<typeof insertPlatformIncidentPlaybookSchema>;
export type PlatformIncidentPlaybook = typeof platformIncidentPlaybooks.$inferSelect;

// AI Knowledge Base - Learn from past fixes to improve auto-healing
export const aiKnowledgeBase = pgTable("ai_knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Error identification
  errorSignature: varchar("error_signature", { length: 64 }).notNull().unique(), // MD5 hash of error pattern
  errorType: text("error_type").notNull(), // 'typescript_error', 'runtime_error', 'build_failure', etc.
  
  // Context about the error
  context: jsonb("context").$type<{
    filePaths?: string[];
    stackTrace?: string;
    errorMessage?: string;
    codeSnippet?: string;
  }>(),
  
  // The fix that worked
  successfulFix: text("successful_fix").notNull(), // Description or diff of the fix
  
  // Confidence and learning metrics
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull().default("0.00"), // 0-100
  timesEncountered: integer("times_encountered").notNull().default(1),
  timesFixed: integer("times_fixed").notNull().default(0), // Successful fix applications
  lastEncountered: timestamp("last_encountered").notNull().defaultNow(),
  
  // Additional metadata
  metadata: jsonb("metadata").$type<{
    complexity?: 'low' | 'medium' | 'high';
    testCoverage?: number;
    averageFixTime?: number; // milliseconds
    relatedErrors?: string[]; // Other error signatures
  }>(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_ai_knowledge_error_type").on(table.errorType),
  index("idx_ai_knowledge_confidence").on(table.confidence),
]);

export const insertAiKnowledgeBaseSchema = createInsertSchema(aiKnowledgeBase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiKnowledgeBase = z.infer<typeof insertAiKnowledgeBaseSchema>;
export type AiKnowledgeBase = typeof aiKnowledgeBase.$inferSelect;

// AI Fix Attempts - Track all fix attempts for learning and debugging
export const aiFixAttempts = pgTable("ai_fix_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links
  errorSignature: varchar("error_signature", { length: 64 }).notNull(), // Foreign key to aiKnowledgeBase
  healingSessionId: varchar("healing_session_id"), // Link to platformHealingSessions
  
  // The proposed fix
  proposedFix: text("proposed_fix").notNull(), // What the AI plans to do
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }).notNull(), // 0-100
  
  // Outcome tracking
  outcome: text("outcome").notNull(), // 'success' | 'failure' | 'rolled_back' | 'pending'
  verificationResults: jsonb("verification_results").$type<{
    typescriptValid?: boolean;
    testsPass?: boolean;
    buildSuccess?: boolean;
    deploymentSuccess?: boolean;
    errorDetails?: string;
  }>(),
  
  // PR tracking (for low-confidence fixes)
  prNumber: integer("pr_number"), // GitHub PR number if created
  prUrl: text("pr_url"), // GitHub PR URL
  autoMerged: boolean("auto_merged").default(false), // True if auto-merged after tests pass
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_ai_fix_error_signature").on(table.errorSignature),
  index("idx_ai_fix_outcome").on(table.outcome),
  index("idx_ai_fix_confidence").on(table.confidenceScore),
]);

export const insertAiFixAttemptSchema = createInsertSchema(aiFixAttempts).omit({
  id: true,
  createdAt: true,
});

export type InsertAiFixAttempt = z.infer<typeof insertAiFixAttemptSchema>;
export type AiFixAttempt = typeof aiFixAttempts.$inferSelect;

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  templateId: varchar("template_id"), // Optional reference to template
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("webapp"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  userId: true, // Server-injected from auth session
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  filename: text("filename").notNull(),
  path: text("path").notNull().default(""), // Folder path (e.g., "src/components/")
  content: text("content").notNull().default(""),
  language: text("language").notNull().default("javascript"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  userId: true, // Server-injected from auth session
  createdAt: true,
  updatedAt: true,
});

export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

export const commands = pgTable("commands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  command: text("command").notNull(),
  response: text("response"),
  status: text("status").notNull().default("pending"),
  platformMode: text("platform_mode").default("user"), // "user" or "platform" - determines if LomuAI modifies user project or Archetype itself
  platformChanges: jsonb("platform_changes"), // Tracks platform file modifications for LomuAI
  autoCommitted: text("auto_committed").default("false"), // Tracks if platform changes were auto-committed to git
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCommandSchema = createInsertSchema(commands).omit({
  id: true,
  userId: true, // Server-injected from auth session
  createdAt: true,
});

export type InsertCommand = z.infer<typeof insertCommandSchema>;
export type Command = typeof commands.$inferSelect;

// LomuAI Tasks - Replit Agent-style task tracking for AI generations
export const lomuAITasks = pgTable("sysop_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  commandId: varchar("command_id"), // Links to the command that created this task
  title: text("title").notNull(), // Task description
  status: text("status").notNull().default("pending"), // 'pending' | 'in_progress' | 'completed' | 'failed'
  priority: integer("priority").notNull().default(1), // 1-12, lower = higher priority
  subAgentId: varchar("sub_agent_id"), // Nullable - tracks if delegated to sub-agent
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_sysop_tasks_user_id").on(table.userId),
  index("idx_sysop_tasks_project_id").on(table.projectId),
  index("idx_sysop_tasks_command_id").on(table.commandId),
]);

export const insertLomuAITaskSchema = createInsertSchema(lomuAITasks).omit({
  id: true,
  userId: true, // Server-injected from auth session
  createdAt: true,
  updatedAt: true,
});

export type InsertLomuAITask = z.infer<typeof insertLomuAITaskSchema>;
export type LomuAITask = typeof lomuAITasks.$inferSelect;

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"), // Link messages to projects (null for LomuAI platform healing)
  fileId: varchar("file_id"),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  images: jsonb("images"), // Array of image URLs/paths for Vision API support
  isSummary: boolean("is_summary").notNull().default(false), // True for compressed conversation summaries
  isPlatformHealing: boolean("is_platform_healing").notNull().default(false), // True for LomuAI platform healing conversations
  platformChanges: jsonb("platform_changes"), // Track file modifications in LomuAI messages
  approvalStatus: text("approval_status"), // null | 'pending_approval' | 'approved' | 'rejected' - Replit Agent-style workflow
  approvalSummary: text("approval_summary"), // Summary of proposed changes awaiting approval
  approvedBy: varchar("approved_by"), // User ID who approved/rejected
  approvedAt: timestamp("approved_at"), // When approval was given
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages)
  .omit({
    id: true,
    userId: true, // Server-injected from auth session
    createdAt: true,
  })
  .extend({
    projectId: z.string().nullable().optional(), // Allow null for general chat conversations
  });

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// LomuAI Attachments - Files attached to chat messages (images, code, logs)
export const lomuAttachments = pgTable('lomu_attachments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar('message_id').notNull(), // References chatMessages.id
  fileName: varchar('file_name').notNull(),
  fileType: varchar('file_type').notNull(), // 'image', 'code', 'log', 'text'
  content: text('content'), // base64 for images, text for code/logs
  mimeType: varchar('mime_type'),
  size: integer('size'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insertLomuAttachmentSchema = createInsertSchema(lomuAttachments).omit({
  id: true,
  createdAt: true,
});

export type InsertLomuAttachment = z.infer<typeof insertLomuAttachmentSchema>;
export type LomuAttachment = typeof lomuAttachments.$inferSelect;

// LomuAI Sessions - Track pending changes in memory before batch commit
export const lomuSessions = pgTable('lomu_sessions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  pendingChanges: jsonb('pending_changes').$type<Array<{
    path: string;
    operation: 'create' | 'modify' | 'delete';
    oldContent?: string;
    newContent: string;
  }>>().default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at').defaultNow(),
  lastUpdated: timestamp('last_updated').defaultNow(),
});

export const insertLomuSessionSchema = createInsertSchema(lomuSessions).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export type InsertLomuSession = z.infer<typeof insertLomuSessionSchema>;
export type LomuSession = typeof lomuSessions.$inferSelect;

// LomuAI Background Jobs - Long-running jobs with resumption capability
export const lomuJobs = pgTable('lomu_jobs', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed' | 'interrupted'
  conversationState: jsonb('conversation_state').$type<Array<{
    role: 'user' | 'assistant';
    content: any;
  }>>().default(sql`'[]'::jsonb`), // Full conversation history for resumption
  lastIteration: integer('last_iteration').notNull().default(0), // Track progress for resumption
  taskListId: varchar('task_list_id'), // Reference to active task list
  error: text('error'), // Error message if failed
  metadata: jsonb('metadata').$type<{
    initialMessage?: string;
    totalIterations?: number;
    filesModified?: number;
    commitsCreated?: number;
  }>(), // Additional context
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const insertLomuJobSchema = createInsertSchema(lomuJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type InsertLomuJob = z.infer<typeof insertLomuJobSchema>;
export type LomuJob = typeof lomuJobs.$inferSelect;

// Usage Tracking & Billing
export const usageLogs = pgTable("usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  type: text("type").notNull(), // 'ai_generation' | 'ai_chat' | 'storage'
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  cost: decimal("cost", { precision: 10, scale: 4 }).notNull().default("0.0000"), // Exact cost in dollars
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUsageLogSchema = createInsertSchema(usageLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertUsageLog = z.infer<typeof insertUsageLogSchema>;
export type UsageLog = typeof usageLogs.$inferSelect;

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  plan: text("plan").notNull().default("free"), // 'free' | 'starter' | 'pro' | 'enterprise'
  status: text("status").notNull().default("active"), // 'active' | 'cancelled' | 'past_due'
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  aiCreditsRemaining: integer("ai_credits_remaining").notNull().default(5), // Projects left in current period
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export const monthlyUsage = pgTable("monthly_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  month: text("month").notNull(), // YYYY-MM format
  aiProjectsCount: integer("ai_projects_count").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  totalAICost: decimal("total_ai_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  storageBytesUsed: bigint("storage_bytes_used", { mode: "number" }).notNull().default(0), // Total file storage in bytes
  storageCost: decimal("storage_cost", { precision: 10, scale: 2 }).notNull().default("0.00"), // $2/GB/month
  deploymentsCount: integer("deployments_count").notNull().default(0), // Active deployments
  deploymentVisits: integer("deployment_visits").notNull().default(0), // Total visits to deployments
  deploymentCost: decimal("deployment_cost", { precision: 10, scale: 2 }).notNull().default("0.00"), // Bandwidth costs
  infraCost: decimal("infra_cost", { precision: 10, scale: 2 }).notNull().default("8.50"), // Base infrastructure cost
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull().default("8.50"),
  planLimit: decimal("plan_limit", { precision: 10, scale: 2 }).notNull().default("0.00"), // Monthly plan cost
  overage: decimal("overage", { precision: 10, scale: 2 }).notNull().default("0.00"), // Amount over plan limit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMonthlyUsageSchema = createInsertSchema(monthlyUsage).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMonthlyUsage = z.infer<typeof insertMonthlyUsageSchema>;
export type MonthlyUsage = typeof monthlyUsage.$inferSelect;

// Deployments - Static site hosting
export const deployments = pgTable("deployments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id").notNull(),
  subdomain: varchar("subdomain").unique().notNull(), // Unique URL slug
  customDomain: varchar("custom_domain"), // Optional custom domain (Business+ tier)
  sslStatus: text("ssl_status").default("pending"), // pending, active, failed
  envVariables: jsonb("env_variables"), // Environment variables (encrypted)
  status: text("status").notNull().default("active"), // active, paused, deleted
  monthlyVisits: integer("monthly_visits").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDeploymentSchema = createInsertSchema(deployments).omit({
  id: true,
  userId: true, // Server-injected from auth session
  monthlyVisits: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;
export type Deployment = typeof deployments.$inferSelect;

// Templates - Pre-built starter projects (Marketplace)
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug").notNull().unique(), // URL-friendly identifier
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // e-commerce, blog, portfolio, saas, landing, game, etc.
  previewUrl: text("preview_url"), // Screenshot or demo URL
  metadata: jsonb("metadata"), // Additional template info (tags, features, tech stack)
  isPremium: integer("is_premium").notNull().default(0), // 0 = free, 1 = paid
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0.00"), // Template price
  authorUserId: varchar("author_user_id"), // Template creator (for revenue split)
  salesCount: integer("sales_count").notNull().default(0), // Total sales
  revenue: decimal("revenue", { precision: 10, scale: 2 }).notNull().default("0.00"), // Total revenue
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

// Template Files - Files associated with each template
export const templateFiles = pgTable("template_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  path: text("path").notNull(), // File path (e.g., "index.html", "src/App.js")
  content: text("content").notNull(),
  language: text("language").notNull().default("javascript"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTemplateFileSchema = createInsertSchema(templateFiles).omit({
  id: true,
  createdAt: true,
});

export type InsertTemplateFile = z.infer<typeof insertTemplateFileSchema>;
export type TemplateFile = typeof templateFiles.$inferSelect;

// Project Versions - Snapshots/checkpoints of projects
export const projectVersions = pgTable("project_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  userId: varchar("user_id").notNull(),
  label: text("label").notNull(), // User-provided label (e.g., "Before adding auth")
  description: text("description"), // Optional description
  metadata: jsonb("metadata"), // Store file count, command that triggered save, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectVersionSchema = createInsertSchema(projectVersions).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertProjectVersion = z.infer<typeof insertProjectVersionSchema>;
export type ProjectVersion = typeof projectVersions.$inferSelect;

// Project Version Files - Files snapshot for each version
export const projectVersionFiles = pgTable("project_version_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  versionId: varchar("version_id").notNull(),
  path: text("path").notNull(),
  content: text("content").notNull(),
  language: text("language").notNull().default("javascript"),
  checksum: text("checksum"), // For deduplication
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectVersionFileSchema = createInsertSchema(projectVersionFiles).omit({
  id: true,
  createdAt: true,
});

export type InsertProjectVersionFile = z.infer<typeof insertProjectVersionFileSchema>;
export type ProjectVersionFile = typeof projectVersionFiles.$inferSelect;

// Template Purchases - Track marketplace template sales
export const templatePurchases = pgTable("template_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  templateId: varchar("template_id").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Price paid at purchase time
  platformCommission: decimal("platform_commission", { precision: 10, scale: 2 }).notNull(), // 20% platform fee
  authorRevenue: decimal("author_revenue", { precision: 10, scale: 2 }).notNull(), // 80% to author
  stripePaymentId: text("stripe_payment_id"), // Stripe payment reference
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Template Reviews - User ratings and reviews for marketplace templates
export const templateReviews = pgTable("template_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  userId: varchar("user_id").notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  title: text("title"), // Review title
  comment: text("comment"), // Detailed review
  isVerifiedPurchase: integer("is_verified_purchase").notNull().default(0), // 1 if user purchased template
  helpfulCount: integer("helpful_count").notNull().default(0), // Number of "helpful" votes
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTemplateReviewSchema = createInsertSchema(templateReviews).omit({
  id: true,
  userId: true,
  helpfulCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTemplateReview = z.infer<typeof insertTemplateReviewSchema>;
export type TemplateReview = typeof templateReviews.$inferSelect;

// Git Repositories - GitHub/GitLab integration
export const gitRepositories = pgTable("git_repositories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id").notNull(),
  provider: text("provider").notNull(), // github, gitlab, bitbucket
  repoUrl: text("repo_url").notNull(), // Full repository URL
  repoName: text("repo_name").notNull(), // Repository name (e.g., "username/repo")
  branch: text("branch").notNull().default("main"), // Default branch
  accessToken: text("access_token"), // Encrypted OAuth token
  lastSyncedAt: timestamp("last_synced_at"), // Last push/pull timestamp
  syncStatus: text("sync_status").default("pending"), // pending, syncing, synced, failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGitRepositorySchema = createInsertSchema(gitRepositories).omit({
  id: true,
  userId: true,
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGitRepository = z.infer<typeof insertGitRepositorySchema>;
export type GitRepository = typeof gitRepositories.$inferSelect;

export const insertTemplatePurchaseSchema = createInsertSchema(templatePurchases).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertTemplatePurchase = z.infer<typeof insertTemplatePurchaseSchema>;
export type TemplatePurchase = typeof templatePurchases.$inferSelect;

// Lead Capture - Email signups from landing page
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  source: text("source").notNull().default("landing_page"), // landing_page, pricing_page, etc.
  metadata: jsonb("metadata"), // UTM params, referrer, etc.
  status: text("status").notNull().default("new"), // new, contacted, converted, unsubscribed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Subscription request schemas
export const upgradeSubscriptionSchema = z.object({
  plan: z.enum(["starter", "pro", "enterprise"]),
});

export type UpgradeSubscriptionRequest = z.infer<typeof upgradeSubscriptionSchema>;

// Processed Stripe Events - Webhook idempotency
export const processedStripeEvents = pgTable("processed_stripe_events", {
  id: varchar("id").primaryKey(), // Stripe event ID
  type: text("type").notNull(),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});

export type ProcessedStripeEvent = typeof processedStripeEvents.$inferSelect;

// Team Workspaces - For Business plan team collaboration
export const teamWorkspaces = pgTable("team_workspaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ownerId: varchar("owner_id").notNull(), // User who created the workspace
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTeamWorkspaceSchema = createInsertSchema(teamWorkspaces).omit({
  id: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTeamWorkspace = z.infer<typeof insertTeamWorkspaceSchema>;
export type TeamWorkspace = typeof teamWorkspaces.$inferSelect;

// Team Members - Users in workspaces with roles
export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("viewer"), // 'owner' | 'editor' | 'viewer'
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

// Team Invitations - Pending invites to workspaces
export const teamInvitations = pgTable("team_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id").notNull(),
  invitedEmail: varchar("invited_email").notNull(),
  role: text("role").notNull().default("viewer"), // 'editor' | 'viewer'
  invitedBy: varchar("invited_by").notNull(), // User ID who sent invite
  status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'declined' | 'expired'
  token: varchar("token").notNull().unique(), // Unique token for accepting invite
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTeamInvitationSchema = createInsertSchema(teamInvitations).omit({
  id: true,
  token: true,
  createdAt: true,
});

export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;
export type TeamInvitation = typeof teamInvitations.$inferSelect;

// API Keys - For Pro/Enterprise users to access REST API
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(), // User-defined key name
  key: varchar("key").notNull().unique(), // The actual API key (hashed)
  keyPrefix: varchar("key_prefix").notNull(), // First 8 chars for display (e.g., "sk_live_abc...")
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"), // Optional expiration
  isActive: integer("is_active").notNull().default(1), // 0 = revoked, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  key: true, // Generated on server
  keyPrefix: true, // Generated on server
  lastUsedAt: true,
  createdAt: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// API Key Usage - Track usage per key for billing
export const apiKeyUsage = pgTable("api_key_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKeyId: varchar("api_key_id").notNull(),
  userId: varchar("user_id").notNull(),
  endpoint: text("endpoint").notNull(), // /api/v1/generate, etc.
  tokensUsed: integer("tokens_used").notNull().default(0),
  cost: decimal("cost", { precision: 10, scale: 4 }).notNull().default("0.0000"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertApiKeyUsageSchema = createInsertSchema(apiKeyUsage).omit({
  id: true,
  createdAt: true,
});

export type InsertApiKeyUsage = z.infer<typeof insertApiKeyUsageSchema>;
export type ApiKeyUsage = typeof apiKeyUsage.$inferSelect;

// Support Tickets - Customer support system
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"), // 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'
  priority: text("priority").notNull().default("normal"), // 'low' | 'normal' | 'high' | 'urgent'
  category: text("category").notNull().default("general"), // 'general' | 'technical' | 'billing' | 'feature_request'
  assignedTo: varchar("assigned_to"), // Admin user ID
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});

export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

// Support Ticket Messages - Conversation thread for each ticket
export const supportTicketMessages = pgTable("support_ticket_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull(),
  userId: varchar("user_id").notNull(),
  message: text("message").notNull(),
  isInternal: integer("is_internal").notNull().default(0), // 0 = visible to user, 1 = admin-only note
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSupportTicketMessageSchema = createInsertSchema(supportTicketMessages).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertSupportTicketMessage = z.infer<typeof insertSupportTicketMessageSchema>;
export type SupportTicketMessage = typeof supportTicketMessages.$inferSelect;

// Team Projects - Projects owned by teams (not individuals)
export const teamProjects = pgTable("team_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().unique(),
  workspaceId: varchar("workspace_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTeamProjectSchema = createInsertSchema(teamProjects).omit({
  id: true,
  createdAt: true,
});

export type InsertTeamProject = z.infer<typeof insertTeamProjectSchema>;
export type TeamProject = typeof teamProjects.$inferSelect;

// Cost Tracking - Track all AI operation costs for transparent billing
export const costTracking = pgTable("cost_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  operationType: text("operation_type").notNull(), // 'ai_generation', 'ai_chat', 'storage', 'bandwidth', 'deployment'
  resourceType: text("resource_type").notNull(), // 'claude_tokens', 'storage_gb', 'bandwidth_gb', etc.
  
  // Token usage (for AI operations)
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  cachedTokens: integer("cached_tokens").default(0),
  
  // Resource usage (for infrastructure)
  storageGb: decimal("storage_gb", { precision: 10, scale: 4 }).default("0"),
  bandwidthGb: decimal("bandwidth_gb", { precision: 10, scale: 4 }).default("0"),
  
  // Cost breakdown
  inputCost: decimal("input_cost", { precision: 10, scale: 6 }).default("0"), // Cost of input tokens
  outputCost: decimal("output_cost", { precision: 10, scale: 6 }).default("0"), // Cost of output tokens
  infrastructureCost: decimal("infrastructure_cost", { precision: 10, scale: 6 }).default("0"), // Storage/bandwidth
  totalCost: decimal("total_cost", { precision: 10, scale: 6 }).notNull(), // Total cost of operation
  
  // Pricing (what user was charged)
  userPrice: decimal("user_price", { precision: 10, scale: 2 }).notNull(), // What we charged the user
  marginPercent: decimal("margin_percent", { precision: 5, scale: 2 }).default("90"), // Profit margin %
  
  metadata: jsonb("metadata"), // Additional context (model used, cache hit rate, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCostTrackingSchema = createInsertSchema(costTracking).omit({
  id: true,
  createdAt: true,
});

export type InsertCostTracking = z.infer<typeof insertCostTrackingSchema>;
export type CostTracking = typeof costTracking.$inferSelect;

// Pricing Configuration - Dynamic pricing tiers (admin-configurable)
export const pricingConfig = pgTable("pricing_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceType: text("resource_type").notNull().unique(), // 'claude_input', 'claude_output', 'storage', etc.
  
  // Cost (our cost from providers)
  providerCost: decimal("provider_cost", { precision: 10, scale: 6 }).notNull(), // What we pay (e.g., $3/M tokens)
  unit: text("unit").notNull(), // 'per_million_tokens', 'per_gb_month', 'per_gb_transfer'
  
  // Pricing (what we charge)
  userPrice: decimal("user_price", { precision: 10, scale: 6 }).notNull(), // What users pay
  marginPercent: decimal("margin_percent", { precision: 5, scale: 2 }).notNull().default("90"), // Target margin %
  
  // Metadata
  description: text("description"), // Human-readable description
  isActive: integer("is_active").notNull().default(1), // 1 = active, 0 = deprecated
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by"), // Admin user ID who last updated
});

export const insertPricingConfigSchema = createInsertSchema(pricingConfig).omit({
  id: true,
  updatedAt: true,
});

export type InsertPricingConfig = z.infer<typeof insertPricingConfigSchema>;
export type PricingConfig = typeof pricingConfig.$inferSelect;

// ============================================================================
// "BUILD-FOR-ME" CUSTOM SERVICE - White-glove development service
// ============================================================================

// Service Requests - Client submissions for custom development projects
export const serviceRequests = pgTable("service_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Client who requested
  
  // Project Details
  projectName: text("project_name").notNull(),
  projectType: text("project_type").notNull(), // 'landing_page', 'web_app', 'ecommerce', 'saas', 'custom'
  description: text("description").notNull(), // Full project requirements
  specifications: jsonb("specifications"), // Detailed specs, features list, etc.
  
  // Pricing & Payment
  quotedPrice: decimal("quoted_price", { precision: 10, scale: 2 }).notNull(), // Total project cost
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }).notNull(), // 50% upfront
  depositPaid: integer("deposit_paid").notNull().default(0), // 0 = pending, 1 = paid
  depositStripeId: text("deposit_stripe_id"), // Stripe payment ID for deposit
  finalPaymentAmount: decimal("final_payment_amount", { precision: 10, scale: 2 }), // Remaining 50%
  finalPaymentPaid: integer("final_payment_paid").notNull().default(0),
  finalPaymentStripeId: text("final_payment_stripe_id"),
  totalPaid: decimal("total_paid", { precision: 10, scale: 2 }).notNull().default("0.00"),
  
  // Status & Timeline
  status: text("status").notNull().default("pending"), // pending, deposit_paid, in_progress, review, completed, cancelled
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  estimatedDelivery: timestamp("estimated_delivery"),
  actualDelivery: timestamp("actual_delivery"),
  
  // Assignment
  assignedToAdminId: varchar("assigned_to_admin_id"), // Admin handling the request
  
  // Preview & Export
  previewProjectId: varchar("preview_project_id"), // Project ID for live preview
  previewUrl: text("preview_url"), // Live preview URL
  exportReady: integer("export_ready").notNull().default(0), // 1 = ready for download
  exportedAt: timestamp("exported_at"),
  
  // Hosting Decision
  hostingChoice: text("hosting_choice"), // 'archetype', 'export', 'undecided'
  hostingMonthlyFee: decimal("hosting_monthly_fee", { precision: 10, scale: 2 }), // If hosting with us
  
  // Metadata
  metadata: jsonb("metadata"), // Additional info, attachments, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({
  id: true,
  userId: true,
  depositPaid: true,
  finalPaymentPaid: true,
  totalPaid: true,
  exportReady: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;
export type ServiceRequest = typeof serviceRequests.$inferSelect;

// Service Messages - Communication between client and admin
export const serviceMessages = pgTable("service_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull(), // Link to service request
  senderId: varchar("sender_id").notNull(), // User ID (could be client or admin)
  senderRole: text("sender_role").notNull(), // 'client' or 'admin'
  
  message: text("message").notNull(),
  attachments: jsonb("attachments"), // File URLs, screenshots, etc.
  isRead: integer("is_read").notNull().default(0), // 0 = unread, 1 = read
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertServiceMessageSchema = createInsertSchema(serviceMessages).omit({
  id: true,
  senderId: true,
  isRead: true,
  createdAt: true,
});

export type InsertServiceMessage = z.infer<typeof insertServiceMessageSchema>;
export type ServiceMessage = typeof serviceMessages.$inferSelect;

// Service Milestones - Payment milestones for large projects
export const serviceMilestones = pgTable("service_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull(),
  
  title: text("title").notNull(), // "Initial Design", "Backend Complete", "Final Delivery"
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, paid
  
  isPaid: integer("is_paid").notNull().default(0),
  stripePaymentId: text("stripe_payment_id"),
  paidAt: timestamp("paid_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertServiceMilestoneSchema = createInsertSchema(serviceMilestones).omit({
  id: true,
  isPaid: true,
  createdAt: true,
});

export type InsertServiceMilestone = z.infer<typeof insertServiceMilestoneSchema>;
export type ServiceMilestone = typeof serviceMilestones.$inferSelect;

// Service Progress Logs - Track all changes/updates (like a changelog)
export const serviceProgressLogs = pgTable("service_progress_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull(),
  
  logType: text("log_type").notNull(), // 'update', 'change_request', 'milestone', 'note'
  title: text("title").notNull(), // "Added login page", "Updated color scheme"
  description: text("description"), // Detailed explanation
  
  changedBy: varchar("changed_by"), // Admin who made the change
  metadata: jsonb("metadata"), // Files changed, features added, etc.
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertServiceProgressLogSchema = createInsertSchema(serviceProgressLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertServiceProgressLog = z.infer<typeof insertServiceProgressLogSchema>;
export type ServiceProgressLog = typeof serviceProgressLogs.$inferSelect;

// Platform Audit Log - Track all platform self-healing operations
export const platformAuditLog = pgTable("platform_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(), // 'heal', 'rollback', 'backup', 'restore'
  description: text("description").notNull(),
  changes: jsonb("changes"), // File changes made
  backupId: varchar("backup_id"), // Reference to backup created/restored
  commitHash: varchar("commit_hash"), // Git commit hash
  status: text("status").notNull(), // 'success', 'failure', 'pending'
  error: text("error"), // Error message if failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlatformAuditLogSchema = createInsertSchema(platformAuditLog).omit({
  id: true,
  createdAt: true,
});

export type InsertPlatformAuditLog = z.infer<typeof insertPlatformAuditLogSchema>;
export type PlatformAuditLog = typeof platformAuditLog.$inferSelect;

// Task Lists - Container for breaking down complex work
export const taskLists = pgTable("task_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"), // Optional - can be for platform work too
  chatMessageId: varchar("chat_message_id"), // Link to the user request
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"), // active, completed, cancelled
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertTaskListSchema = createInsertSchema(taskLists).omit({
  id: true,
  createdAt: true,
});

export type InsertTaskList = z.infer<typeof insertTaskListSchema>;
export type TaskList = typeof taskLists.$inferSelect;

// Tasks - Individual work items within a task list
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskListId: varchar("task_list_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed_pending_review, completed, cancelled
  architectReviewed: text("architect_reviewed"), // yes, no, not_applicable
  architectReviewReason: text("architect_review_reason"),
  subAgentId: varchar("sub_agent_id"), // If delegated to a sub-agent
  result: text("result"), // Result summary
  error: text("error"), // Error message if failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Sub Agents - Track delegated work
export const subAgents = pgTable("sub_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  taskId: varchar("task_id"), // Link to parent task if spawned for a task
  agentType: text("agent_type").notNull(), // architect, specialist, tester, etc.
  task: text("task").notNull(), // What the sub-agent was asked to do
  context: jsonb("context"), // Context passed to sub-agent
  status: text("status").notNull().default("running"), // running, completed, failed, cancelled
  result: text("result"), // Final result/output
  error: text("error"), // Error if failed
  tokensUsed: integer("tokens_used").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertSubAgentSchema = createInsertSchema(subAgents).omit({
  id: true,
  createdAt: true,
});

export type InsertSubAgent = z.infer<typeof insertSubAgentSchema>;
export type SubAgent = typeof subAgents.$inferSelect;

// Architect Reviews - Proactive feedback and suggestions
export const architectReviews = pgTable("architect_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  taskId: varchar("task_id"), // Link to task being reviewed
  taskListId: varchar("task_list_id"),
  reviewType: text("review_type").notNull(), // proactive, requested, post_completion
  findings: text("findings").notNull(), // Review findings and suggestions
  severity: text("severity").notNull(), // info, warning, critical
  status: text("status").notNull().default("pending"), // pending, addressed, dismissed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertArchitectReviewSchema = createInsertSchema(architectReviews).omit({
  id: true,
  createdAt: true,
});

export type InsertArchitectReview = z.infer<typeof insertArchitectReviewSchema>;
export type ArchitectReview = typeof architectReviews.$inferSelect;

// LomuAI Knowledge Base - Stores learned patterns, decisions, and fixes
export const lomuKnowledge = pgTable("lomu_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // 'pattern' | 'fix' | 'decision' | 'rule' | 'preference'
  title: text("title").notNull(), // Brief description of the knowledge
  description: text("description").notNull(), // Detailed explanation
  context: text("context"), // When/why this was learned
  solution: text("solution"), // How to handle this situation
  tags: text("tags").array(), // Searchable tags for quick retrieval
  filePatterns: text("file_patterns").array(), // File patterns this applies to (e.g., ['*.tsx', 'client/**'])
  priority: integer("priority").notNull().default(5), // 1-10, higher = more important
  active: boolean("active").notNull().default(true), // Can be deactivated without deletion
  usageCount: integer("usage_count").notNull().default(0), // How many times this was referenced
  lastUsedAt: timestamp("last_used_at"),
  createdBy: varchar("created_by"), // User ID or 'system' or 'meta-sysop'
  approvedBy: varchar("approved_by"), // User ID who approved this knowledge (I AM architect)
  metadata: jsonb("metadata"), // Additional structured data
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_lomu_knowledge_category").on(table.category),
  index("idx_lomu_knowledge_active").on(table.active),
  index("idx_lomu_knowledge_priority").on(table.priority),
]);

export const insertLomuKnowledgeSchema = createInsertSchema(lomuKnowledge).omit({
  id: true,
  usageCount: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLomuKnowledge = z.infer<typeof insertLomuKnowledgeSchema>;
export type LomuKnowledge = typeof lomuKnowledge.$inferSelect;

// LomuAI Instructions - User-given permanent instructions and preferences
export const lomuInstructions = pgTable("lomu_instructions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'permanent' | 'conditional' | 'project-specific'
  instruction: text("instruction").notNull(), // The actual instruction text
  scope: text("scope").notNull().default("global"), // 'global' | 'platform' | 'user-projects'
  conditions: jsonb("conditions"), // When this instruction applies (e.g., { fileType: 'tsx', operation: 'fix' })
  priority: integer("priority").notNull().default(5), // 1-10, determines order of application
  active: boolean("active").notNull().default(true),
  exampleBehavior: text("example_behavior"), // Example of how to follow this instruction
  createdBy: varchar("created_by").notNull(), // User ID who created this
  approvedBy: varchar("approved_by"), // User ID who approved (for governance)
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_lomu_instructions_type").on(table.type),
  index("idx_lomu_instructions_scope").on(table.scope),
  index("idx_lomu_instructions_active").on(table.active),
]);

export const insertLomuInstructionSchema = createInsertSchema(lomuInstructions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLomuInstruction = z.infer<typeof insertLomuInstructionSchema>;
export type LomuInstruction = typeof lomuInstructions.$inferSelect;

// LomuAI Automation Rules - Automated workflows and triggers
export const lomuAutomation = pgTable("lomu_automation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Human-readable name for this automation
  description: text("description").notNull(),
  trigger: text("trigger").notNull(), // What triggers this automation (e.g., 'error_detected', 'scheduled', 'user_request')
  triggerConditions: jsonb("trigger_conditions").notNull(), // Specific conditions that must be met
  actions: jsonb("actions").notNull(), // Array of actions to take (e.g., [{ type: 'fix_file', params: {...} }])
  requiresApproval: boolean("requires_approval").notNull().default(true), // Whether I AM must approve before execution
  autoCommit: boolean("auto_commit").notNull().default(false), // Whether to auto-commit to GitHub
  active: boolean("active").notNull().default(true),
  executionCount: integer("execution_count").notNull().default(0),
  lastExecutedAt: timestamp("last_executed_at"),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  createdBy: varchar("created_by").notNull(),
  approvedBy: varchar("approved_by"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_lomu_automation_trigger").on(table.trigger),
  index("idx_lomu_automation_active").on(table.active),
]);

export const insertLomuAutomationSchema = createInsertSchema(lomuAutomation).omit({
  id: true,
  executionCount: true,
  lastExecutedAt: true,
  successCount: true,
  failureCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLomuAutomation = z.infer<typeof insertLomuAutomationSchema>;
export type LomuAutomation = typeof lomuAutomation.$inferSelect;

// LomuAI Memory Log - Conversation memory and context retention
export const lomuMemory = pgTable("lomu_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id"), // Groups related memories together
  memoryType: text("memory_type").notNull(), // 'conversation' | 'decision' | 'learning' | 'feedback'
  content: text("content").notNull(), // The actual memory content
  context: jsonb("context"), // Additional context about this memory
  importance: integer("importance").notNull().default(5), // 1-10, determines retention priority
  relatedKnowledgeIds: text("related_knowledge_ids").array(), // Links to knowledge entries
  expiresAt: timestamp("expires_at"), // Optional expiry for temporary memories
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_lomu_memory_session").on(table.sessionId),
  index("idx_lomu_memory_type").on(table.memoryType),
  index("idx_lomu_memory_importance").on(table.importance),
]);

export const insertLomuMemorySchema = createInsertSchema(lomuMemory).omit({
  id: true,
  createdAt: true,
});

export type InsertLomuMemory = z.infer<typeof insertLomuMemorySchema>;
export type LomuMemory = typeof lomuMemory.$inferSelect;

// ============================================================================
// REPLIT AGENT-STYLE FEATURES (Message Queue, Autonomy, Image Gen, etc.)
// ============================================================================

// Message Queue - Queue follow-up requests while agent is working
export const messageQueue = pgTable("message_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  message: text("message").notNull(),
  priority: integer("priority").notNull().default(5), // 1-10, higher = more urgent
  status: text("status").notNull().default("queued"), // queued, processing, completed, cancelled
  queuedAt: timestamp("queued_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata"), // Additional context
}, (table) => [
  index("idx_message_queue_user").on(table.userId),
  index("idx_message_queue_status").on(table.status),
]);

export const insertMessageQueueSchema = createInsertSchema(messageQueue).omit({
  id: true,
  queuedAt: true,
});

export type InsertMessageQueue = z.infer<typeof insertMessageQueueSchema>;
export type MessageQueue = typeof messageQueue.$inferSelect;

// User Autonomy Settings - Configure agent behavior preferences
export const userAutonomySettings = pgTable("user_autonomy_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  autonomyLevel: text("autonomy_level").notNull().default("medium"), // low, medium, high, max
  autoCommit: boolean("auto_commit").notNull().default(false), // Auto-commit to git
  autoDeploy: boolean("auto_deploy").notNull().default(false), // Auto-deploy after completion
  requireReview: boolean("require_review").notNull().default(true), // Require architect review
  allowSubAgents: boolean("allow_sub_agents").notNull().default(true), // Allow spawning sub-agents
  maxConcurrentTasks: integer("max_concurrent_tasks").notNull().default(3), // Max parallel tasks
  autoTestingEnabled: boolean("auto_testing_enabled").notNull().default(true), // Run tests automatically
  preferences: jsonb("preferences"), // Additional custom preferences
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserAutonomySettingsSchema = createInsertSchema(userAutonomySettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserAutonomySettings = z.infer<typeof insertUserAutonomySettingsSchema>;
export type UserAutonomySettings = typeof userAutonomySettings.$inferSelect;

// AI Image Generation History - Track generated images
export const imageGenerations = pgTable("image_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  prompt: text("prompt").notNull(), // User's image generation prompt
  model: text("model").notNull().default("gpt-image-1"), // AI model used
  imageUrl: text("image_url"), // Stored image URL (in app storage)
  width: integer("width"),
  height: integer("height"),
  quality: text("quality").default("standard"), // standard, hd
  style: text("style"), // vivid, natural
  status: text("status").notNull().default("pending"), // pending, completed, failed
  tokensUsed: integer("tokens_used").default(0),
  cost: decimal("cost", { precision: 10, scale: 4 }).default("0.0000"),
  error: text("error"), // Error message if failed
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_image_gen_user").on(table.userId),
  index("idx_image_gen_project").on(table.projectId),
]);

export const insertImageGenerationSchema = createInsertSchema(imageGenerations).omit({
  id: true,
  createdAt: true,
});

export type InsertImageGeneration = z.infer<typeof insertImageGenerationSchema>;
export type ImageGeneration = typeof imageGenerations.$inferSelect;

// Dynamic Intelligence Sessions - Extended thinking mode sessions
export const dynamicIntelligenceSessions = pgTable("dynamic_intelligence_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  taskId: varchar("task_id"), // Link to task if applicable
  mode: text("mode").notNull(), // extended_thinking, high_power
  problem: text("problem").notNull(), // Problem being analyzed
  analysis: text("analysis"), // Deep analysis result
  recommendations: text("recommendations"), // Recommended solutions
  tokensUsed: integer("tokens_used").default(0),
  thinkingTime: integer("thinking_time").default(0), // Seconds spent thinking
  cost: decimal("cost", { precision: 10, scale: 4 }).default("0.0000"),
  status: text("status").notNull().default("running"), // running, completed, failed
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_dynamic_intel_user").on(table.userId),
  index("idx_dynamic_intel_mode").on(table.mode),
]);

export const insertDynamicIntelligenceSessionSchema = createInsertSchema(dynamicIntelligenceSessions).omit({
  id: true,
  createdAt: true,
});

export type InsertDynamicIntelligenceSession = z.infer<typeof insertDynamicIntelligenceSessionSchema>;
export type DynamicIntelligenceSession = typeof dynamicIntelligenceSessions.$inferSelect;

// Task Runners - Parallel task execution workers
export const taskRunners = pgTable("task_runners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  taskId: varchar("task_id"), // Task being executed
  runnerType: text("runner_type").notNull(), // parallel, sequential, background
  status: text("status").notNull().default("idle"), // idle, running, paused, completed, failed
  currentStep: text("current_step"), // Current operation
  progress: integer("progress").default(0), // 0-100%
  tokensUsed: integer("tokens_used").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_task_runner_user").on(table.userId),
  index("idx_task_runner_status").on(table.status),
]);

export const insertTaskRunnerSchema = createInsertSchema(taskRunners).omit({
  id: true,
  createdAt: true,
});

export type InsertTaskRunner = z.infer<typeof insertTaskRunnerSchema>;
export type TaskRunner = typeof taskRunners.$inferSelect;

// Visual Edits - Track direct UI edits in preview
export const visualEdits = pgTable("visual_edits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id").notNull(),
  fileId: varchar("file_id").notNull(), // File being edited
  editType: text("edit_type").notNull(), // style, component, layout
  selector: text("selector"), // CSS selector or component path
  changes: jsonb("changes").notNull(), // { property: value } pairs
  generatedCode: text("generated_code"), // Code generated from visual edit
  applied: boolean("applied").notNull().default(false), // Whether edit was applied to source
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_visual_edits_project").on(table.projectId),
  index("idx_visual_edits_file").on(table.fileId),
]);

export const insertVisualEditSchema = createInsertSchema(visualEdits).omit({
  id: true,
  createdAt: true,
});

export type InsertVisualEdit = z.infer<typeof insertVisualEditSchema>;
export type VisualEdit = typeof visualEdits.$inferSelect;

// ==================== PLAN MODE TABLES ====================
// Plan Sessions - Brainstorming and planning without code modification
export const planSessions = pgTable("plan_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"), // active, completed, archived
  metadata: jsonb("metadata"), // AI conversation context, preferences
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_plan_sessions_user").on(table.userId),
  index("idx_plan_sessions_project").on(table.projectId),
]);

export const insertPlanSessionSchema = createInsertSchema(planSessions).omit({
  id: true,
  createdAt: true,
});

export type InsertPlanSession = z.infer<typeof insertPlanSessionSchema>;
export type PlanSession = typeof planSessions.$inferSelect;

// Plan Steps - Individual steps in a plan session
export const planSteps = pgTable("plan_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  stepNumber: integer("step_number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, skipped
  estimatedTime: integer("estimated_time"), // Estimated minutes
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_plan_steps_session").on(table.sessionId),
]);

export const insertPlanStepSchema = createInsertSchema(planSteps).omit({
  id: true,
  createdAt: true,
});

export type InsertPlanStep = z.infer<typeof insertPlanStepSchema>;
export type PlanStep = typeof planSteps.$inferSelect;

// ==================== DESIGN PROTOTYPE TABLES ====================
// Design Prototypes - Quick frontend prototypes from "Start with Design" mode
export const designPrototypes = pgTable("design_prototypes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  planSessionId: varchar("plan_session_id"), // Link to plan if created from Plan Mode
  name: text("name").notNull(),
  description: text("description"),
  screens: jsonb("screens").notNull(), // Array of screen definitions with components
  designSystemTokens: jsonb("design_system_tokens"), // Colors, typography, spacing
  generatedFiles: jsonb("generated_files"), // Files generated for this prototype
  status: text("status").notNull().default("draft"), // draft, approved, building
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
}, (table) => [
  index("idx_design_prototypes_user").on(table.userId),
  index("idx_design_prototypes_project").on(table.projectId),
]);

export const insertDesignPrototypeSchema = createInsertSchema(designPrototypes).omit({
  id: true,
  createdAt: true,
});

export type InsertDesignPrototype = z.infer<typeof insertDesignPrototypeSchema>;
export type DesignPrototype = typeof designPrototypes.$inferSelect;

// ==================== WORKFLOWS TABLES ====================
// Workflows - Parallel/sequential command execution definitions
export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  name: text("name").notNull(),
  description: text("description"),
  executionMode: text("execution_mode").notNull().default("parallel"), // parallel, sequential
  steps: jsonb("steps").notNull(), // Array of workflow steps with commands
  environment: jsonb("environment"), // Environment variables for workflow
  isTemplate: boolean("is_template").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_workflows_user").on(table.userId),
  index("idx_workflows_project").on(table.projectId),
]);

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

// Workflow Runs - Execution history and status
export const workflowRuns = pgTable("workflow_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull(),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().default("running"), // running, completed, failed, cancelled
  currentStep: integer("current_step").default(0),
  totalSteps: integer("total_steps").notNull(),
  output: text("output"), // Combined stdout/stderr
  error: text("error"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_workflow_runs_workflow").on(table.workflowId),
  index("idx_workflow_runs_user").on(table.userId),
]);

export const insertWorkflowRunSchema = createInsertSchema(workflowRuns).omit({
  id: true,
  startedAt: true,
});

export type InsertWorkflowRun = z.infer<typeof insertWorkflowRunSchema>;
export type WorkflowRun = typeof workflowRuns.$inferSelect;

// ==================== AGENTS & AUTOMATIONS TABLES ====================
// Automation Templates - Prebuilt automation definitions (Slackbot, Telegram, Cron)
export const automationTemplates = pgTable("automation_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // slackbot, telegram, scheduled, webhook
  description: text("description"),
  icon: text("icon"), // Icon name/URL
  connectorType: text("connector_type"), // slack, telegram, github, notion, etc.
  configSchema: jsonb("config_schema").notNull(), // JSON schema for configuration
  codeTemplate: text("code_template").notNull(), // Template code with placeholders
  isOfficial: boolean("is_official").notNull().default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_automation_templates_category").on(table.category),
]);

export const insertAutomationTemplateSchema = createInsertSchema(automationTemplates).omit({
  id: true,
  createdAt: true,
});

export type InsertAutomationTemplate = z.infer<typeof insertAutomationTemplateSchema>;
export type AutomationTemplate = typeof automationTemplates.$inferSelect;

// Automation Runs - User's deployed automations
export const automationRuns = pgTable("automation_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  templateId: varchar("template_id"), // Reference to template if used
  name: text("name").notNull(),
  category: text("category").notNull(),
  config: jsonb("config").notNull(), // User's specific configuration
  status: text("status").notNull().default("active"), // active, paused, stopped, error
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"), // For scheduled automations
  executionCount: integer("execution_count").default(0),
  errorCount: integer("error_count").default(0),
  deploymentUrl: text("deployment_url"), // URL if deployed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_automation_runs_user").on(table.userId),
  index("idx_automation_runs_template").on(table.templateId),
]);

export const insertAutomationRunSchema = createInsertSchema(automationRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAutomationRun = z.infer<typeof insertAutomationRunSchema>;
export type AutomationRun = typeof automationRuns.$inferSelect;

// ==================== GENERAL AGENT MODE TABLES ====================
// Project Settings - Extended settings for different project types
export const projectSettings = pgTable("project_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().unique(),
  projectType: text("project_type").notNull().default("webapp"), // webapp, game, mobile, cli, api, automation
  framework: text("framework"), // react, vue, unity, pygame, flutter, express, etc.
  buildCommand: text("build_command"),
  startCommand: text("start_command"),
  testCommand: text("test_command"),
  deploymentConfig: jsonb("deployment_config"),
  customSettings: jsonb("custom_settings"), // Type-specific settings
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_project_settings_project").on(table.projectId),
  index("idx_project_settings_type").on(table.projectType),
]);

export const insertProjectSettingsSchema = createInsertSchema(projectSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProjectSettings = z.infer<typeof insertProjectSettingsSchema>;
export type ProjectSettings = typeof projectSettings.$inferSelect;

// ==================== PLATFORM HEALING TABLES ====================
// Healing Targets - What can be healed (platform code, user projects, customer projects)
export const healingTargets = pgTable("healing_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Owner of this target
  type: text("type").notNull(), // 'platform' | 'user_project' | 'customer_project'
  name: text("name").notNull(), // Display name
  projectId: varchar("project_id"), // Link to projects table if user_project
  customerId: varchar("customer_id"), // Link to users table if customer_project
  railwayProjectId: text("railway_project_id"), // Railway project ID for deployment
  repositoryUrl: text("repository_url"), // Git repo URL
  lastSyncedAt: timestamp("last_synced_at"),
  status: text("status").notNull().default("active"), // 'active' | 'archived'
  metadata: jsonb("metadata"), // Additional config
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_healing_targets_user").on(table.userId),
  index("idx_healing_targets_type").on(table.type),
]);

export const insertHealingTargetSchema = createInsertSchema(healingTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertHealingTarget = z.infer<typeof insertHealingTargetSchema>;
export type HealingTarget = typeof healingTargets.$inferSelect;

// Healing Conversations - Persistent chat sessions
export const healingConversations = pgTable("healing_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetId: varchar("target_id").notNull(), // Link to healingTargets
  userId: varchar("user_id").notNull(),
  title: text("title").notNull().default("New Healing Session"),
  status: text("status").notNull().default("active"), // 'active' | 'completed' | 'paused'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_healing_conversations_target").on(table.targetId),
  index("idx_healing_conversations_user").on(table.userId),
]);

export const insertHealingConversationSchema = createInsertSchema(healingConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertHealingConversation = z.infer<typeof insertHealingConversationSchema>;
export type HealingConversation = typeof healingConversations.$inferSelect;

// Healing Messages - Chat history
export const healingMessages = pgTable("healing_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // Tool calls, diffs, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_healing_messages_conversation").on(table.conversationId),
]);

export const insertHealingMessageSchema = createInsertSchema(healingMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertHealingMessage = z.infer<typeof insertHealingMessageSchema>;
export type HealingMessage = typeof healingMessages.$inferSelect;
