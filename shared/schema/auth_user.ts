import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, jsonb, index, bigint, boolean, serial, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  
  // OAuth fields for dual authentication (Replit Auth + Local)
  provider: varchar("provider"), // 'replit' | 'local' | null (for legacy users)
  providerId: varchar("provider_id"), // OAuth user ID (e.g., Replit's sub claim)
  
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("user"), // user, admin
  isOwner: boolean("is_owner").notNull().default(false), // Platform owner (can modify platform in production)
  autonomyLevel: varchar("autonomy_level", { length: 20 }).notNull().default("basic"), // 'basic' | 'standard' | 'deep' | 'max' - Controls LomuAI capabilities
  billingStatus: text("billing_status").notNull().default("trial"), // Enum: 'trial', 'trial_grace', 'active', 'suspended'
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID
  defaultPaymentMethodId: varchar("default_payment_method_id"), // Stripe payment method ID
  lastLoginAt: timestamp("last_login_at"), // Track last login time
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Composite unique index for OAuth users - prevents duplicate accounts from same provider
  uniqueIndex("users_provider_provider_id_unique").on(table.provider, table.providerId),
]);

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

// User Preferences - AI model selection and theme
export const userPreferences = pgTable("user_preferences", {
  userId: varchar("user_id").primaryKey(),
  aiModel: varchar("ai_model").notNull().default("claude"), // "claude" or "gemini"
  theme: varchar("theme").default("light"), // "light" or "dark"
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserPreferenceSchema = createInsertSchema(userPreferences).omit({
  updatedAt: true,
});

export type InsertUserPreference = z.infer<typeof insertUserPreferenceSchema>;
export type UserPreference = typeof userPreferences.$inferSelect;

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

// Credit Wallets - One wallet per user for credit-based billing
export const creditWallets = pgTable("credit_wallets", {
  userId: varchar("user_id").primaryKey(), // One wallet per user
  availableCredits: integer("available_credits").notNull().default(0), // Credits ready to use
  reservedCredits: integer("reserved_credits").notNull().default(0), // Credits reserved for active agent runs
  initialMonthlyCredits: integer("initial_monthly_credits").notNull().default(5000), // User's monthly credit allowance based on subscription tier
  lastTopUpAt: timestamp("last_top_up_at"), // When user last purchased credits
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCreditWalletSchema = createInsertSchema(creditWallets).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertCreditWallet = z.infer<typeof insertCreditWalletSchema>;
export type CreditWallet = typeof creditWallets.$inferSelect;

// Credit Ledger - Transaction log for all credit movements
export const creditLedger = pgTable("credit_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Foreign key to users
  deltaCredits: integer("delta_credits").notNull(), // +/- credits (positive for additions, negative for consumption)
  usdAmount: decimal("usd_amount", { precision: 10, scale: 4 }), // Dollar amount (for purchases)
  source: text("source").notNull(), // Enum: 'monthly_allocation', 'purchase', 'lomu_chat', 'architect_consultation', 'refund', 'adjustment'
  referenceId: varchar("reference_id"), // Link to related record (usage log, stripe payment, etc.)
  metadata: jsonb("metadata").$type<{
    owner_exempt?: boolean; // True for owner free usage
    package?: string; // Credit package purchased
    model?: string; // AI model used
    [key: string]: any;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_credit_ledger_user_id").on(table.userId),
  index("idx_credit_ledger_source").on(table.source),
  index("idx_credit_ledger_created_at").on(table.createdAt),
]);

export const insertCreditLedgerSchema = createInsertSchema(creditLedger).omit({
  id: true,
  createdAt: true,
});

export type InsertCreditLedger = z.infer<typeof insertCreditLedgerSchema>;
export type CreditLedger = typeof creditLedger.$inferSelect;

// Token Ledger - Production-grade token tracking for Gemini API usage
export const tokenLedger = pgTable("token_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: varchar("user_id").notNull(), // Foreign key to users
  totalTokens: integer("total_tokens").notNull(),
  promptTokens: integer("prompt_tokens").notNull(),
  candidatesTokens: integer("candidates_tokens").notNull(),
  modelUsed: varchar("model_used").notNull(), // 'gemini-2.5-flash' or 'gemini-2.5-pro'
  requestType: varchar("request_type").notNull(), // 'CODE_GEN', 'RAG_SEARCH', 'SECURITY_SCAN', etc.
  costUsd: decimal("cost_usd", { precision: 10, scale: 6 }).notNull(),
  creditsCharged: integer("credits_charged").notNull(),
  agentRunId: varchar("agent_run_id"), // Optional link to agent session
  targetContext: varchar("target_context").notNull(), // 'platform' or 'project'
  projectId: varchar("project_id"), // Nullable for platform healing
}, (table) => [
  index("idx_token_ledger_user_id").on(table.userId),
  index("idx_token_ledger_target_context").on(table.targetContext),
  index("idx_token_ledger_timestamp").on(table.timestamp),
]);

export const insertTokenLedgerSchema = createInsertSchema(tokenLedger).omit({
  id: true,
  timestamp: true,
});

export type InsertTokenLedger = z.infer<typeof insertTokenLedgerSchema>;
export type TokenLedgerEntry = typeof tokenLedger.$inferSelect;

// Usage Tracking & Billing
export const usageLogs = pgTable("usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id"),
  type: text("type").notNull(), // 'ai_generation' | 'ai_chat' | 'lomu_chat' | 'architect_consultation' | 'storage'
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
  tokensUsed: integer("tokens_used").notNull().default(0), // Plan-counted tokens (LomuAI chat)
  totalAICost: decimal("total_ai_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  premiumAICost: decimal("premium_ai_cost", { precision: 10, scale: 2 }).notNull().default("0.00"), // I AM Architect premium billing
  storageBytesUsed: bigint("storage_bytes_used", { mode: "number" }).notNull().default(0), // Total file storage in bytes
  storageCost: decimal("storage_cost", { precision: 10, scale: 2 }).notNull().default("0.00"), // $2/GB/month
  deploymentsCount: integer("deployments_count").notNull().default(0), // Active deployments
  deploymentVisits: integer("deployment_visits").notNull().default(0), // Total visits to deployments
  deploymentCost: decimal("deployment_cost", { precision: 10, scale: 2 }).notNull().default("0.00"), // Bandwidth costs
  infraCost: decimal("infra_cost", { precision: 10, scale: 2 }).notNull().default("8.50"), // Base infrastructure cost
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull().default("8.50"),
  planLimit: decimal("plan_limit", { precision: 10, scale: 2 }).notNull().default("0.00"), // Monthly plan cost
  overage: decimal("overage", { precision: 10, scale: 2 }).notNull().default("0.00"), // Amount over plan limit
  creditsConsumed: integer("credits_consumed").notNull().default(0), // Total credits used this month
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

// Credit Math Constants - Pricing and conversion rates for credit-based billing
// Updated 2025: Competitive pricing with Gemini 2.5 Flash (40x cheaper than Claude)
export const CREDIT_CONSTANTS = {
  TOKENS_PER_CREDIT: 1000, // 1 credit = 1000 tokens
  CREDIT_DOLLAR_VALUE: 0.50, // $0.50 per 1K tokens (retail) - 50% cheaper than Replit
  PROVIDER_COST_PER_CREDIT: 0.0001875, // $0.0001875 blended cost (Gemini 2.5 Flash: $0.075 input / $0.30 output per 1M)
  MARGIN_PERCENT: 99.96, // 99.96% gross margin on credits (Gemini advantage!)
  
  // I AM Architect Premium Pricing (Claude Sonnet 4 for premium consulting)
  I_AM_BASE_COST: 0.39, // $0.39 provider cost per consultation (Claude Sonnet 4)
  I_AM_STARTER_PRICE: 1.50, // $1.50 per consultation (Starter tier)
  I_AM_PRO_PRICE: 1.00, // $1.00 per consultation (Pro tier - discounted)
  I_AM_BUSINESS_PRICE: 0.75, // $0.75 per consultation (Business tier - team discount)
  I_AM_ENTERPRISE_PRICE: 0, // Free for Enterprise (unlimited included)
};

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

// Error Signature Deduplication - Prevent charging twice for same error
export const errorSignatureDeduplication = pgTable("error_signature_deduplication", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  projectId: varchar("project_id").notNull(),

  // Error signature (MD5 hash)
  errorSignature: varchar("error_signature", { length: 64 }).notNull(),
  errorType: text("error_type").notNull(),
  errorMessage: text("error_message").notNull(),

  // Fix tracking
  firstAttemptId: varchar("first_attempt_id").notNull(), // First fix attempt for this error
  lastAttemptId: varchar("last_attempt_id").notNull(), // Most recent fix attempt
  totalAttempts: integer("total_attempts").notNull().default(1),
  successfulAttempts: integer("successful_attempts").notNull().default(0),

  // Payment tracking (prevent double-charging)
  totalCharged: decimal("total_charged", { precision: 10, scale: 2 }).notNull().default("0.00"),
  lastChargedAt: timestamp("last_charged_at"),

  // Resolution status
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"), // Fix attempt ID that resolved it

  // Learning
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull().default("0.00"), // Increases with successful fixes

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_error_dedup_user_project").on(table.userId, table.projectId),
  index("idx_error_dedup_signature").on(table.errorSignature),
  index("idx_error_dedup_resolved").on(table.resolved),
]);

export const insertErrorSignatureDeduplicationSchema = createInsertSchema(errorSignatureDeduplication).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertErrorSignatureDeduplication = z.infer<typeof insertErrorSignatureDeduplicationSchema>;
export type ErrorSignatureDeduplication = typeof errorSignatureDeduplication.$inferSelect;
