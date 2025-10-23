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
  platformMode: text("platform_mode").default("user"), // "user" or "platform" - determines if SySop modifies user project or Archetype itself
  platformChanges: jsonb("platform_changes"), // Tracks platform file modifications for Meta-SySop
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

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"), // Link messages to projects
  fileId: varchar("file_id"),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  images: jsonb("images"), // Array of image URLs/paths for Vision API support
  isSummary: boolean("is_summary").notNull().default(false), // True for compressed conversation summaries
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
