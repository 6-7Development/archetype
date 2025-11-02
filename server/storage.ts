import { 
  type User, 
  type UpsertUser,
  type File, 
  type InsertFile,
  type ChatMessage,
  type InsertChatMessage,
  type Project,
  type InsertProject,
  type ProjectFolder,
  type InsertProjectFolder,
  type FileUpload,
  type InsertFileUpload,
  type Command,
  type InsertCommand,
  type Subscription,
  type UsageLog,
  type MonthlyUsage,
  type Deployment,
  type InsertDeployment,
  type BuildJob,
  type InsertBuildJob,
  type CustomDomain,
  type InsertCustomDomain,
  type DeploymentLog,
  type InsertDeploymentLog,
  type Template,
  type InsertTemplate,
  type TemplateFile,
  type InsertTemplateFile,
  type ProjectVersion,
  type InsertProjectVersion,
  type ProjectVersionFile,
  type InsertProjectVersionFile,
  type TemplatePurchase,
  type InsertTemplatePurchase,
  type Lead,
  type InsertLead,
  type TeamWorkspace,
  type TeamMember,
  type TeamInvitation,
  type ApiKey,
  type SupportTicket,
  type SupportTicketMessage,
  type ServiceRequest,
  type InsertServiceRequest,
  type ServiceMessage,
  type InsertServiceMessage,
  type ServiceMilestone,
  type InsertServiceMilestone,
  type ServiceProgressLog,
  type InsertServiceProgressLog,
  type SatisfactionSurvey,
  type InsertSatisfactionSurvey,
  type MaintenanceMode,
  type LomuAITask,
  type InsertLomuAITask,
  type UserAvatarState,
  type InsertUserAvatarState,
  type HealingTarget,
  type InsertHealingTarget,
  type HealingConversation,
  type InsertHealingConversation,
  type HealingMessage,
  type InsertHealingMessage,
  type ConversationState,
  type InsertConversationState,
  type TerminalHistory,
  type InsertTerminalHistory,
  type ProjectMigration,
  type InsertProjectMigration,
  users,
  files,
  chatMessages,
  projects,
  projectFolders,
  fileUploads,
  commands,
  lomuAITasks,
  subscriptions,
  usageLogs,
  monthlyUsage,
  deployments,
  buildJobs,
  customDomains,
  deploymentLogs,
  templates,
  templateFiles,
  projectVersions,
  projectVersionFiles,
  templatePurchases,
  leads,
  teamWorkspaces,
  teamMembers,
  teamInvitations,
  apiKeys,
  supportTickets,
  supportTicketMessages,
  templateReviews,
  gitRepositories,
  serviceRequests,
  serviceMessages,
  serviceMilestones,
  serviceProgressLogs,
  satisfactionSurveys,
  maintenanceMode,
  userAvatarState,
  healingTargets,
  healingConversations,
  healingMessages,
  conversationStates,
  terminalHistory,
  projectMigrations
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { PLAN_LIMITS } from "./usage-tracking";
import crypto from "crypto";
import bcrypt from "bcrypt";

// SECURITY: Encryption utilities for sensitive data (git tokens, etc.)
// Uses AES-256-GCM with SESSION_SECRET as the encryption key
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts sensitive data (e.g., git access tokens) using AES-256-GCM
 * @param plaintext The data to encrypt
 * @returns Base64-encoded encrypted data with IV and auth tag
 */
function encryptValue(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET not configured - cannot encrypt sensitive data');
  }

  // Derive a 32-byte key from SESSION_SECRET using SHA-256
  const key = crypto.createHash('sha256').update(sessionSecret).digest();
  
  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  // Get auth tag
  const authTag = cipher.getAuthTag();
  
  // Combine IV + authTag + encrypted data into single base64 string
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]);
  return combined.toString('base64');
}

/**
 * Decrypts sensitive data encrypted with encryptValue()
 * @param encrypted Base64-encoded encrypted data
 * @returns Decrypted plaintext
 */
function decryptValue(encrypted: string): string {
  if (!encrypted) return encrypted;
  
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET not configured - cannot decrypt sensitive data');
  }

  try {
    // Derive the same 32-byte key
    const key = crypto.createHash('sha256').update(sessionSecret).digest();
    
    // Decode from base64
    const combined = Buffer.from(encrypted, 'base64');
    
    // Extract IV, auth tag, and encrypted data
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedData = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[STORAGE] Decryption failed:', error);
    throw new Error('Failed to decrypt sensitive data - invalid encryption or key mismatch');
  }
}

// Server-side types that include userId (not exposed to client)
type InsertFileWithUser = InsertFile & { userId: string };
type InsertProjectWithUser = InsertProject & { userId: string };
type InsertCommandWithUser = InsertCommand & { userId: string };
type InsertChatMessageWithUser = InsertChatMessage & { userId: string };
type InsertDeploymentWithUser = InsertDeployment & { userId: string };
type InsertProjectVersionWithUser = InsertProjectVersion & { userId: string };
type InsertProjectFolderWithUser = InsertProjectFolder & { userId: string };
type InsertFileUploadWithUser = InsertFileUpload & { userId: string };

export interface IStorage {
  // User operations (IMPORTANT: mandatory for authentication)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User[] | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  getFiles(userId: string): Promise<File[]>;
  getFile(id: string, userId: string): Promise<File | undefined>;
  createFile(file: InsertFileWithUser): Promise<File>;
  updateFile(id: string, userId: string, content: string): Promise<File>;
  deleteFile(id: string, userId: string): Promise<void>;
  
  getChatMessages(userId: string, fileId?: string): Promise<ChatMessage[]>;
  getChatMessagesByProject(userId: string, projectId: string): Promise<ChatMessage[]>;
  getChatHistory(userId: string, projectId: string | null): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessageWithUser): Promise<ChatMessage>;
  deleteChatMessage(id: string, userId: string): Promise<void>;
  
  getProjects(userId: string): Promise<Project[]>;
  getAllProjects(): Promise<Project[]>; // Admin only - get all projects across all users
  getProject(id: string, userId: string): Promise<Project | undefined>;
  createProject(project: InsertProjectWithUser): Promise<Project>;
  deleteProject(id: string, userId: string): Promise<void>;
  
  getCommands(userId: string, projectId: string | null): Promise<Command[]>;
  createCommand(command: InsertCommandWithUser): Promise<Command>;
  updateCommand(id: string, userId: string, status: string, response: string | null, projectId?: string | null): Promise<Command>;
  
  // SySop Task operations
  getTasks(commandId: string): Promise<LomuAITask[]>;
  getTasksByProject(projectId: string, userId: string): Promise<LomuAITask[]>;
  createTask(task: InsertLomuAITask & { userId: string }): Promise<LomuAITask>;
  updateTaskStatus(taskId: string, status: string): Promise<LomuAITask>;
  
  // Subscription operations
  getSubscription(userId: string): Promise<Subscription | undefined>;
  getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | undefined>;
  updateSubscription(userId: string, plan: string): Promise<Subscription>;
  cancelSubscription(userId: string): Promise<Subscription>;
  updateStripeCustomerId(userId: string, stripeCustomerId: string): Promise<Subscription>;
  
  // Deployment operations (Cloudflare Pages integration)
  getDeployments(userId: string): Promise<Deployment[]>;
  getDeployment(deploymentId: string): Promise<Deployment | null>;
  getDeploymentBySubdomain(subdomain: string): Promise<Deployment | null>;
  createDeployment(deployment: InsertDeployment): Promise<Deployment>;
  updateDeployment(deploymentId: string, updates: Partial<Deployment>): Promise<Deployment>;
  deleteDeployment(deploymentId: string): Promise<void>;
  
  // Build Job operations
  getBuildJobs(projectId: string): Promise<BuildJob[]>;
  getBuildJob(buildJobId: string): Promise<BuildJob | null>;
  createBuildJob(buildJob: InsertBuildJob): Promise<BuildJob>;
  updateBuildJob(buildJobId: string, updates: Partial<BuildJob>): Promise<BuildJob>;
  
  // Custom Domain operations
  getCustomDomains(userId: string): Promise<CustomDomain[]>;
  getCustomDomain(domainId: string): Promise<CustomDomain | null>;
  getCustomDomainByDomain(domain: string): Promise<CustomDomain | null>;
  createCustomDomain(domain: InsertCustomDomain): Promise<CustomDomain>;
  updateCustomDomain(domainId: string, updates: Partial<CustomDomain>): Promise<CustomDomain>;
  deleteCustomDomain(domainId: string): Promise<void>;
  
  // Deployment Logs operations
  getDeploymentLogs(buildJobId: string): Promise<DeploymentLog[]>;
  createDeploymentLog(log: InsertDeploymentLog): Promise<DeploymentLog>;
  
  // Admin operations
  getAllUsersWithDetails(): Promise<any[]>;
  getAdminStats(): Promise<any>;
  getUserDetailsForAdmin(userId: string): Promise<any>;
  updateUserRole(userId: string, role: string): Promise<User>;
  getUsageAnalytics(months?: number): Promise<any>;
  getRecentUsageLogs(limit?: number): Promise<any[]>;
  
  // Maintenance Mode operations
  getMaintenanceMode(): Promise<any>;
  enableMaintenanceMode(userId: string, reason?: string): Promise<any>;
  disableMaintenanceMode(): Promise<any>;
  
  // Owner operations
  getOwner(): Promise<User | undefined>;
  setOwner(userId: string): Promise<User>;
  
  // Avatar State operations
  getUserAvatarState(userId: string): Promise<UserAvatarState | undefined>;
  upsertUserAvatarState(userId: string, state: Partial<InsertUserAvatarState>): Promise<UserAvatarState>;
  updateAvatarMood(userId: string, mood: string): Promise<UserAvatarState>;
  
  // Template operations
  getTemplates(): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  getTemplateBySlug(slug: string): Promise<Template | undefined>;
  getTemplateFiles(templateId: string): Promise<TemplateFile[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  createTemplateFile(file: InsertTemplateFile): Promise<TemplateFile>;
  
  // Template Review operations
  getTemplateReviews(templateId: string): Promise<any[]>;
  createTemplateReview(review: { templateId: string; userId: string; rating: number; title?: string; comment?: string; isVerifiedPurchase: number }): Promise<any>;
  updateTemplateReview(reviewId: string, userId: string, updates: { rating?: number; title?: string; comment?: string }): Promise<any>;
  deleteTemplateReview(reviewId: string, userId: string): Promise<void>;
  incrementReviewHelpful(reviewId: string): Promise<any>;
  
  // Template Marketplace operations
  hasUserPurchasedTemplate(userId: string, templateId: string): Promise<boolean>;
  createTemplatePurchase(purchase: Omit<InsertTemplatePurchase, 'userId'> & { userId: string }): Promise<TemplatePurchase>;
  getUserTemplatePurchases(userId: string): Promise<TemplatePurchase[]>;
  incrementTemplateSales(templateId: string, price: number): Promise<void>;
  
  // Project version operations
  getProjectVersions(projectId: string, userId: string): Promise<ProjectVersion[]>;
  getProjectVersion(versionId: string, userId: string): Promise<ProjectVersion | undefined>;
  getProjectVersionFiles(versionId: string): Promise<ProjectVersionFile[]>;
  createProjectVersion(version: InsertProjectVersionWithUser): Promise<ProjectVersion>;
  createProjectVersionFile(file: InsertProjectVersionFile): Promise<ProjectVersionFile>;
  restoreProjectVersion(versionId: string, userId: string): Promise<void>;
  
  // Iterative project operations
  getProjectFiles(projectId: string, userId?: string): Promise<File[]>;
  batchUpdateProjectFiles(projectId: string, userId: string, filesToUpdate: Array<{ filename: string; content: string; language: string }>): Promise<File[]>;
  
  // Team Workspace operations
  getTeamWorkspaces(userId: string): Promise<any[]>;
  getTeamWorkspace(workspaceId: string, userId: string): Promise<any | undefined>;
  createTeamWorkspace(name: string, description: string | undefined, ownerId: string): Promise<any>;
  updateTeamWorkspace(workspaceId: string, ownerId: string, name: string, description: string | undefined): Promise<any>;
  deleteTeamWorkspace(workspaceId: string, ownerId: string): Promise<void>;
  
  // Team Member operations
  getTeamMembers(workspaceId: string, userId: string): Promise<any[]>;
  getTeamMember(workspaceId: string, userId: string): Promise<any | undefined>;
  addTeamMember(workspaceId: string, userId: string, role: string): Promise<any>;
  updateTeamMemberRole(workspaceId: string, userId: string, role: string, requesterId: string): Promise<any>;
  removeTeamMember(workspaceId: string, userId: string, requesterId: string): Promise<void>;
  getUserRole(workspaceId: string, userId: string): Promise<string | undefined>;
  
  // Team Invitation operations
  getTeamInvitations(workspaceId: string, userId: string): Promise<any[]>;
  createTeamInvitation(workspaceId: string, invitedEmail: string, role: string, invitedBy: string): Promise<any>;
  getTeamInvitationByToken(token: string): Promise<any | undefined>;
  acceptTeamInvitation(token: string, userId: string): Promise<any>;
  declineTeamInvitation(token: string): Promise<void>;
  
  // API Key operations  
  getApiKeys(userId: string): Promise<any[]>;
  createApiKey(userId: string, name: string, expiresAt: Date | null): Promise<{ key: string; apiKey: any }>;
  revokeApiKey(keyId: string, userId: string): Promise<void>;
  validateApiKey(key: string): Promise<any | undefined>;
  updateApiKeyLastUsed(keyId: string): Promise<void>;
  
  // Git Repository operations
  getGitRepository(projectId: string, userId: string): Promise<any | undefined>;
  createGitRepository(repo: { projectId: string; userId: string; provider: string; repoUrl: string; repoName: string; branch?: string; accessToken?: string }): Promise<any>;
  updateGitSyncStatus(projectId: string, userId: string, status: string): Promise<any>;
  deleteGitRepository(projectId: string, userId: string): Promise<void>;

  // Support Ticket operations
  getSupportTickets(userId: string): Promise<any[]>;
  getSupportTicket(ticketId: string, userId: string): Promise<any | undefined>;
  getAllSupportTickets(adminUserId: string): Promise<any[]>;
  createSupportTicket(userId: string, subject: string, description: string, category: string, priority: string): Promise<any>;
  updateSupportTicketStatus(ticketId: string, status: string, resolvedAt: Date | null): Promise<any>;
  assignSupportTicket(ticketId: string, assignedTo: string | null): Promise<any>;
  getSupportTicketMessages(ticketId: string, userId: string): Promise<any[]>;
  createSupportTicketMessage(ticketId: string, userId: string, message: string, isInternal: number): Promise<any>;
  
  // "Build-for-Me" Custom Service operations
  getServiceRequests(userId: string): Promise<ServiceRequest[]>;
  getAllServiceRequests(adminUserId: string): Promise<ServiceRequest[]>;
  getServiceRequest(requestId: string, userId: string): Promise<ServiceRequest | undefined>;
  createServiceRequest(request: Omit<InsertServiceRequest, 'userId'> & { userId: string }): Promise<ServiceRequest>;
  updateServiceRequestStatus(requestId: string, status: string): Promise<ServiceRequest>;
  updateServiceRequestPayment(requestId: string, paymentType: 'deposit' | 'final', stripePaymentId: string, amount: string): Promise<ServiceRequest>;
  assignServiceRequest(requestId: string, adminId: string): Promise<ServiceRequest>;
  updateServiceRequestPreview(requestId: string, previewProjectId: string, previewUrl: string): Promise<ServiceRequest>;
  getServiceMessages(requestId: string): Promise<ServiceMessage[]>;
  createServiceMessage(message: Omit<InsertServiceMessage, 'senderId'> & { senderId: string }): Promise<ServiceMessage>;
  markServiceMessagesRead(requestId: string, userId: string): Promise<void>;
  getServiceMilestones(requestId: string): Promise<ServiceMilestone[]>;
  createServiceMilestone(milestone: InsertServiceMilestone): Promise<ServiceMilestone>;
  updateServiceMilestoneStatus(milestoneId: string, status: string, isPaid: number, stripePaymentId?: string): Promise<ServiceMilestone>;
  getServiceProgressLogs(requestId: string): Promise<ServiceProgressLog[]>;
  createServiceProgressLog(log: InsertServiceProgressLog): Promise<ServiceProgressLog>;
  
  // Project Version/Snapshot operations (Rollback feature)
  createProjectSnapshot(projectId: string, userId: string, label: string, description?: string): Promise<ProjectVersion>;
  getProjectSnapshots(projectId: string, userId: string): Promise<ProjectVersion[]>;
  rollbackToSnapshot(projectId: string, snapshotId: string, userId: string): Promise<void>;
  
  // Healing Target operations
  getHealingTargets(userId: string): Promise<HealingTarget[]>;
  getHealingTarget(id: string, userId: string): Promise<HealingTarget | undefined>;
  createHealingTarget(target: InsertHealingTarget & { userId: string }): Promise<HealingTarget>;
  
  // Healing Conversation operations
  getHealingConversations(targetId: string, userId: string): Promise<HealingConversation[]>;
  getHealingConversation(id: string): Promise<HealingConversation | undefined>;
  createHealingConversation(conversation: InsertHealingConversation & { userId: string }): Promise<HealingConversation>;
  updateHealingConversation(id: string, updates: Partial<HealingConversation>): Promise<HealingConversation>;
  
  // Healing Message operations
  getHealingMessages(conversationId: string): Promise<HealingMessage[]>;
  createHealingMessage(message: InsertHealingMessage): Promise<HealingMessage>;
  clearHealingMessages(conversationId: string): Promise<void>;
  
  // Conversation State operations (context tracking)
  getConversationState(userId: string, projectId: string | null): Promise<ConversationState | null>;
  createConversationState(state: InsertConversationState & { userId: string }): Promise<ConversationState>;
  updateConversationState(id: string, updates: Partial<ConversationState>): Promise<ConversationState>;
  clearConversationState(id: string): Promise<ConversationState>;
  
  // Project Folder operations
  getProjectFolders(projectId: string, userId: string): Promise<ProjectFolder[]>;
  getProjectFolder(id: string, userId: string): Promise<ProjectFolder | undefined>;
  createProjectFolder(folder: InsertProjectFolderWithUser): Promise<ProjectFolder>;
  updateProjectFolder(id: string, userId: string, name: string): Promise<ProjectFolder>;
  deleteProjectFolder(id: string, userId: string): Promise<void>;
  
  // File Upload operations
  getFileUploads(projectId: string, userId: string): Promise<FileUpload[]>;
  getFileUpload(id: string, userId: string): Promise<FileUpload | undefined>;
  createFileUpload(upload: InsertFileUploadWithUser): Promise<FileUpload>;
  deleteFileUpload(id: string, userId: string): Promise<void>;
  
  // File operations (move, rename, bulk delete)
  moveFile(fileId: string, userId: string, folderId: string | null): Promise<File>;
  renameFile(fileId: string, userId: string, filename: string): Promise<File>;
  bulkDeleteFiles(fileIds: string[], userId: string): Promise<void>;
  
  // Terminal History operations
  createTerminalHistory(history: InsertTerminalHistory): Promise<TerminalHistory>;
  updateTerminalHistory(projectId: string, userId: string, command: string, output: string, exitCode: number): Promise<void>;
  getTerminalHistory(projectId: string, userId: string, limit?: number): Promise<TerminalHistory[]>;
  
  // Project Migration operations
  getProjectMigrations(projectId: string, userId: string): Promise<ProjectMigration[]>;
  getProjectMigration(id: string, userId: string): Promise<ProjectMigration | undefined>;
  createProjectMigration(migration: InsertProjectMigration & { userId: string }): Promise<ProjectMigration>;
  updateMigrationStatus(id: string, status: string, appliedAt?: Date): Promise<ProjectMigration>;
  getAppliedMigrations(projectId: string, userId: string): Promise<ProjectMigration[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User[] | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result.length > 0 ? result : undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email, // Conflict on email (unique field), not id
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getFiles(userId: string): Promise<File[]> {
    return await db
      .select()
      .from(files)
      .where(eq(files.userId, userId))
      .orderBy(desc(files.updatedAt));
  }

  async getFile(id: string, userId: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(
      and(eq(files.id, id), eq(files.userId, userId))
    );
    return file || undefined;
  }

  async createFile(insertFile: InsertFileWithUser): Promise<File> {
    const [file] = await db
      .insert(files)
      .values(insertFile)
      .returning();
    return file;
  }

  async updateFile(id: string, userId: string, content: string): Promise<File> {
    const [file] = await db
      .update(files)
      .set({ content, updatedAt: new Date() })
      .where(and(eq(files.id, id), eq(files.userId, userId)))
      .returning();
    if (!file) {
      throw new Error('File not found or access denied');
    }
    return file;
  }

  async deleteFile(id: string, userId: string): Promise<void> {
    const result = await db
      .delete(files)
      .where(and(eq(files.id, id), eq(files.userId, userId)))
      .returning();
    if (result.length === 0) {
      throw new Error('File not found or access denied');
    }
  }

  async getChatMessages(userId: string, fileId?: string): Promise<ChatMessage[]> {
    if (fileId) {
      return await db
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.userId, userId), eq(chatMessages.fileId, fileId)))
        .orderBy(chatMessages.createdAt);
    }
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(chatMessages.createdAt);
  }

  async getChatMessagesByProject(userId: string, projectId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, userId), eq(chatMessages.projectId, projectId)))
      .orderBy(chatMessages.createdAt);
  }

  async getChatHistory(userId: string, projectId: string | null): Promise<ChatMessage[]> {
    // Handle NULL/undefined/"general" projectIds for general chat
    if (!projectId || projectId === 'general') {
      return this.getNonProjectChatMessages(userId);
    }
    // Otherwise get project-specific chat
    return this.getChatMessagesByProject(userId, projectId);
  }

  async getNonProjectChatMessages(userId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, userId), sql`${chatMessages.projectId} IS NULL`))
      .orderBy(chatMessages.createdAt);
  }

  async createChatMessage(insertMessage: InsertChatMessageWithUser): Promise<ChatMessage> {
    const [message] = await db
      .insert(chatMessages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async deleteChatMessage(id: string, userId: string): Promise<void> {
    await db.delete(chatMessages).where(
      and(eq(chatMessages.id, id), eq(chatMessages.userId, userId))
    );
  }

  async getProjects(userId: string): Promise<Project[]> {
    const projectsList = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt));
    
    // Fetch file counts for each project
    const projectsWithCounts = await Promise.all(
      projectsList.map(async (project) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(files)
          .where(and(eq(files.projectId, project.id), eq(files.userId, userId)));
        
        return {
          ...project,
          fileCount: Number(countResult?.count || 0)
        };
      })
    );
    
    return projectsWithCounts;
  }

  async getAllProjects(): Promise<Project[]> {
    // Admin only - fetch all projects across all users
    const projectsList = await db
      .select({
        id: projects.id,
        userId: projects.userId,
        name: projects.name,
        description: projects.description,
        type: projects.type,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        templateId: projects.templateId,
        userEmail: users.email,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`.as('userName'),
      })
      .from(projects)
      .leftJoin(users, eq(projects.userId, users.id))
      .orderBy(desc(projects.updatedAt));
    
    // Fetch file counts for each project
    const projectsWithCounts = await Promise.all(
      projectsList.map(async (project) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(files)
          .where(eq(files.projectId, project.id));
        
        return {
          ...project,
          fileCount: Number(countResult?.count || 0)
        };
      })
    );
    
    return projectsWithCounts as any;
  }

  async getProject(id: string, userId: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(
      and(eq(projects.id, id), eq(projects.userId, userId))
    );
    return project || undefined;
  }

  async createProject(insertProject: InsertProjectWithUser): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(insertProject)
      .returning();
    return project;
  }

  async deleteProject(id: string, userId: string): Promise<void> {
    // Delete all related data first (files, commands, chat messages, etc.)
    await db.delete(files).where(
      and(eq(files.projectId, id), eq(files.userId, userId))
    );
    
    await db.delete(commands).where(
      and(eq(commands.projectId, id), eq(commands.userId, userId))
    );
    
    // Delete the project itself
    await db.delete(projects).where(
      and(eq(projects.id, id), eq(projects.userId, userId))
    );
  }

  async getCommands(userId: string, projectId: string | null): Promise<Command[]> {
    if (projectId) {
      return await db
        .select()
        .from(commands)
        .where(and(eq(commands.userId, userId), eq(commands.projectId, projectId)))
        .orderBy(desc(commands.createdAt));
    }
    // Return ALL commands for the user (regardless of projectId) when projectId param is null
    return await db
      .select()
      .from(commands)
      .where(eq(commands.userId, userId))
      .orderBy(desc(commands.createdAt));
  }

  async createCommand(insertCommand: InsertCommandWithUser): Promise<Command> {
    const [command] = await db
      .insert(commands)
      .values(insertCommand)
      .returning();
    return command;
  }

  async updateCommand(id: string, userId: string, status: string, response: string | null, projectId?: string | null): Promise<Command> {
    const updateData: any = {
      status,
      response,
    };
    
    if (projectId !== undefined) {
      updateData.projectId = projectId;
    }

    const [command] = await db
      .update(commands)
      .set(updateData)
      .where(and(eq(commands.id, id), eq(commands.userId, userId)))
      .returning();
    
    if (!command) {
      throw new Error('Command not found or access denied');
    }
    return command;
  }

  async getTasks(commandId: string): Promise<LomuAITask[]> {
    return await db
      .select()
      .from(lomuAITasks)
      .where(eq(lomuAITasks.commandId, commandId))
      .orderBy(lomuAITasks.priority);
  }

  async getTasksByProject(projectId: string, userId: string): Promise<LomuAITask[]> {
    return await db
      .select()
      .from(lomuAITasks)
      .where(and(eq(lomuAITasks.projectId, projectId), eq(lomuAITasks.userId, userId)))
      .orderBy(desc(lomuAITasks.createdAt));
  }

  async createTask(task: InsertLomuAITask & { userId: string }): Promise<LomuAITask> {
    const [created] = await db
      .insert(lomuAITasks)
      .values(task)
      .returning();
    return created;
  }

  async updateTaskStatus(taskId: string, status: string): Promise<LomuAITask> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const [task] = await db
      .update(lomuAITasks)
      .set(updateData)
      .where(eq(lomuAITasks.id, taskId))
      .returning();
    
    if (!task) {
      throw new Error('Task not found');
    }
    return task;
  }

  async getSubscription(userId: string): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    return subscription || undefined;
  }

  async getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return subscription || undefined;
  }

  async updateSubscription(userId: string, plan: string): Promise<Subscription> {
    const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
    if (!planLimits) {
      throw new Error(`Invalid plan: ${plan}`);
    }

    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Check if subscription exists, create if not
    const existing = await this.getSubscription(userId);
    
    if (!existing) {
      // Create new subscription with the requested plan
      const [subscription] = await db
        .insert(subscriptions)
        .values({
          userId,
          plan,
          status: 'active',
          aiCreditsRemaining: planLimits.aiCredits,
          currentPeriodStart,
          currentPeriodEnd,
        })
        .returning();
      return subscription;
    }

    // Update existing subscription (reactivate if cancelled)
    const [subscription] = await db
      .update(subscriptions)
      .set({
        plan,
        status: 'active', // Reactivate subscription
        aiCreditsRemaining: planLimits.aiCredits,
        currentPeriodStart,
        currentPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId))
      .returning();

    if (!subscription) {
      throw new Error('Subscription update failed');
    }
    return subscription;
  }

  async cancelSubscription(userId: string): Promise<Subscription> {
    const [subscription] = await db
      .update(subscriptions)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId))
      .returning();

    if (!subscription) {
      throw new Error('Subscription not found');
    }
    return subscription;
  }

  async updateStripeCustomerId(userId: string, stripeCustomerId: string): Promise<Subscription> {
    const [subscription] = await db
      .update(subscriptions)
      .set({
        stripeCustomerId,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId))
      .returning();

    if (!subscription) {
      throw new Error('Subscription not found. Cannot update Stripe customer ID.');
    }
    return subscription;
  }

  // Admin methods
  async getAllUsersWithDetails(): Promise<any[]> {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt,
        plan: subscriptions.plan,
        status: subscriptions.status,
        aiCreditsRemaining: subscriptions.aiCreditsRemaining,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(users)
      .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
      .orderBy(desc(users.createdAt));
    
    return result;
  }

  async getAdminStats(): Promise<any> {
    // Get total users
    const totalUsersResult = await db.select({ count: sql<number>`count(*)` }).from(users);
    const totalUsers = Number(totalUsersResult[0]?.count || 0);

    // Get active subscriptions
    const activeSubsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'));
    const activeSubscriptions = Number(activeSubsResult[0]?.count || 0);

    // Get plan distribution
    const planDistribution = await db
      .select({
        plan: subscriptions.plan,
        count: sql<number>`count(*)`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'))
      .groupBy(subscriptions.plan);

    // Calculate total revenue (estimate based on plan prices)
    const planPrices = { free: 0, starter: 29, pro: 99, enterprise: 499 };
    const monthlyRevenue = planDistribution.reduce((sum, item) => {
      const price = planPrices[item.plan as keyof typeof planPrices] || 0;
      return sum + (price * Number(item.count));
    }, 0);

    return {
      totalUsers,
      activeSubscriptions,
      monthlyRevenue,
      planDistribution: planDistribution.map(p => ({
        plan: p.plan,
        count: Number(p.count),
      })),
    };
  }

  async getUserDetailsForAdmin(userId: string): Promise<any> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return null;
    }

    const subscription = await this.getSubscription(userId);
    const projectsData = await this.getProjects(userId);

    return {
      ...user,
      subscription,
      projectCount: projectsData.length,
    };
  }

  async updateUserRole(userId: string, role: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async getUsageAnalytics(months: number = 6): Promise<any> {
    // Get monthly usage trends for the last N months
    const monthlyTrends = await db
      .select({
        month: monthlyUsage.month,
        totalTokens: sql<number>`SUM(${monthlyUsage.totalTokens})::int`,
        totalAICost: sql<number>`SUM(${monthlyUsage.totalAICost})::numeric`,
        totalRevenue: sql<number>`SUM(${monthlyUsage.planLimit})::numeric`,
        totalCost: sql<number>`SUM(${monthlyUsage.totalCost})::numeric`,
        overage: sql<number>`SUM(${monthlyUsage.overage})::numeric`,
      })
      .from(monthlyUsage)
      .groupBy(monthlyUsage.month)
      .orderBy(desc(monthlyUsage.month))
      .limit(months);

    // Get top users by usage
    const topUsers = await db
      .select({
        userId: monthlyUsage.userId,
        email: users.email,
        totalTokens: sql<number>`SUM(${monthlyUsage.totalTokens})::int`,
        totalCost: sql<number>`SUM(${monthlyUsage.totalCost})::numeric`,
      })
      .from(monthlyUsage)
      .leftJoin(users, eq(monthlyUsage.userId, users.id))
      .groupBy(monthlyUsage.userId, users.email)
      .orderBy(desc(sql`SUM(${monthlyUsage.totalCost})`))
      .limit(10);

    // Get usage by type
    const usageByType = await db
      .select({
        type: usageLogs.type,
        count: sql<number>`COUNT(*)::int`,
        totalTokens: sql<number>`SUM(${usageLogs.totalTokens})::int`,
        totalCost: sql<number>`SUM(${usageLogs.cost})::numeric`,
      })
      .from(usageLogs)
      .groupBy(usageLogs.type);

    return {
      monthlyTrends: monthlyTrends.map(t => ({
        month: t.month,
        totalTokens: Number(t.totalTokens),
        totalAICost: Number(t.totalAICost),
        totalRevenue: Number(t.totalRevenue),
        totalCost: Number(t.totalCost),
        overage: Number(t.overage),
      })),
      topUsers: topUsers.map(u => ({
        userId: u.userId,
        email: u.email,
        totalTokens: Number(u.totalTokens),
        totalCost: Number(u.totalCost),
      })),
      usageByType: usageByType.map(u => ({
        type: u.type,
        count: Number(u.count),
        totalTokens: Number(u.totalTokens),
        totalCost: Number(u.totalCost),
      })),
    };
  }

  async getRecentUsageLogs(limit: number = 100): Promise<any[]> {
    const logs = await db
      .select({
        id: usageLogs.id,
        userId: usageLogs.userId,
        email: users.email,
        type: usageLogs.type,
        inputTokens: usageLogs.inputTokens,
        outputTokens: usageLogs.outputTokens,
        totalTokens: usageLogs.totalTokens,
        cost: usageLogs.cost,
        createdAt: usageLogs.createdAt,
      })
      .from(usageLogs)
      .leftJoin(users, eq(usageLogs.userId, users.id))
      .orderBy(desc(usageLogs.createdAt))
      .limit(limit);

    return logs.map(log => ({
      ...log,
      cost: Number(log.cost),
    }));
  }

  // Maintenance Mode operations
  async getMaintenanceMode(): Promise<any> {
    const modes = await db
      .select()
      .from(maintenanceMode)
      .limit(1);

    if (modes.length === 0) {
      // Create default maintenance mode entry if it doesn't exist
      const [newMode] = await db
        .insert(maintenanceMode)
        .values({ enabled: false })
        .returning();
      return newMode;
    }

    return modes[0];
  }

  async enableMaintenanceMode(userId: string, reason?: string): Promise<any> {
    const existing = await this.getMaintenanceMode();

    const [updated] = await db
      .update(maintenanceMode)
      .set({
        enabled: true,
        enabledBy: userId,
        enabledAt: new Date(),
        reason: reason || 'Platform maintenance in progress',
        updatedAt: new Date(),
      })
      .where(eq(maintenanceMode.id, existing.id))
      .returning();

    return updated;
  }

  async disableMaintenanceMode(): Promise<any> {
    const existing = await this.getMaintenanceMode();

    const [updated] = await db
      .update(maintenanceMode)
      .set({
        enabled: false,
        enabledBy: null,
        enabledAt: null,
        reason: null,
        updatedAt: new Date(),
      })
      .where(eq(maintenanceMode.id, existing.id))
      .returning();

    return updated;
  }

  // Owner operations
  async getOwner(): Promise<User | undefined> {
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.isOwner, true))
      .limit(1);
    
    return owner || undefined;
  }

  async setOwner(userId: string): Promise<User> {
    // First, clear any existing owner
    await db
      .update(users)
      .set({ isOwner: false })
      .where(eq(users.isOwner, true));
    
    // Set the new owner
    const [updatedUser] = await db
      .update(users)
      .set({ isOwner: true })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error(`User ${userId} not found`);
    }
    
    return updatedUser;
  }

  // Avatar State operations
  async getUserAvatarState(userId: string): Promise<UserAvatarState | undefined> {
    const [state] = await db
      .select()
      .from(userAvatarState)
      .where(eq(userAvatarState.userId, userId));
    
    return state || undefined;
  }

  async upsertUserAvatarState(userId: string, state: Partial<InsertUserAvatarState>): Promise<UserAvatarState> {
    const [avatarState] = await db
      .insert(userAvatarState)
      .values({
        userId,
        ...state,
      })
      .onConflictDoUpdate({
        target: userAvatarState.userId,
        set: {
          ...state,
          lastMoodChange: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return avatarState;
  }

  async updateAvatarMood(userId: string, mood: string): Promise<UserAvatarState> {
    const [avatarState] = await db
      .insert(userAvatarState)
      .values({
        userId,
        currentMood: mood,
      })
      .onConflictDoUpdate({
        target: userAvatarState.userId,
        set: {
          currentMood: mood,
          lastMoodChange: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return avatarState;
  }

  // Deployment operations (Cloudflare Pages integration)
  async getDeployments(userId: string): Promise<Deployment[]> {
    return await db
      .select()
      .from(deployments)
      .where(eq(deployments.userId, userId))
      .orderBy(desc(deployments.createdAt));
  }

  async getDeployment(deploymentId: string): Promise<Deployment | null> {
    const [deployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, deploymentId));
    return deployment || null;
  }

  async getDeploymentBySubdomain(subdomain: string): Promise<Deployment | null> {
    const [deployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.subdomain, subdomain));
    return deployment || null;
  }

  async createDeployment(deployment: InsertDeployment): Promise<Deployment> {
    const [created] = await db
      .insert(deployments)
      .values(deployment)
      .returning();
    return created;
  }

  async updateDeployment(deploymentId: string, updates: Partial<Deployment>): Promise<Deployment> {
    const [deployment] = await db
      .update(deployments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(deployments.id, deploymentId))
      .returning();
    if (!deployment) {
      throw new Error('Deployment not found');
    }
    return deployment;
  }

  async deleteDeployment(deploymentId: string): Promise<void> {
    const result = await db
      .delete(deployments)
      .where(eq(deployments.id, deploymentId))
      .returning();
    if (result.length === 0) {
      throw new Error('Deployment not found');
    }
  }

  // Build Job operations
  async getBuildJobs(projectId: string): Promise<BuildJob[]> {
    return await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.projectId, projectId))
      .orderBy(desc(buildJobs.createdAt));
  }

  async getBuildJob(buildJobId: string): Promise<BuildJob | null> {
    const [buildJob] = await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.id, buildJobId));
    return buildJob || null;
  }

  async createBuildJob(buildJob: InsertBuildJob): Promise<BuildJob> {
    const [created] = await db
      .insert(buildJobs)
      .values(buildJob)
      .returning();
    return created;
  }

  async updateBuildJob(buildJobId: string, updates: Partial<BuildJob>): Promise<BuildJob> {
    const [buildJob] = await db
      .update(buildJobs)
      .set(updates)
      .where(eq(buildJobs.id, buildJobId))
      .returning();
    if (!buildJob) {
      throw new Error('Build job not found');
    }
    return buildJob;
  }

  // Custom Domain operations
  async getCustomDomains(userId: string): Promise<CustomDomain[]> {
    return await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.userId, userId))
      .orderBy(desc(customDomains.createdAt));
  }

  async getCustomDomain(domainId: string): Promise<CustomDomain | null> {
    const [domain] = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.id, domainId));
    return domain || null;
  }

  async getCustomDomainByDomain(domain: string): Promise<CustomDomain | null> {
    const [customDomain] = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.domain, domain));
    return customDomain || null;
  }

  async createCustomDomain(domain: InsertCustomDomain): Promise<CustomDomain> {
    const [created] = await db
      .insert(customDomains)
      .values(domain)
      .returning();
    return created;
  }

  async updateCustomDomain(domainId: string, updates: Partial<CustomDomain>): Promise<CustomDomain> {
    const [customDomain] = await db
      .update(customDomains)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customDomains.id, domainId))
      .returning();
    if (!customDomain) {
      throw new Error('Custom domain not found');
    }
    return customDomain;
  }

  async deleteCustomDomain(domainId: string): Promise<void> {
    const result = await db
      .delete(customDomains)
      .where(eq(customDomains.id, domainId))
      .returning();
    if (result.length === 0) {
      throw new Error('Custom domain not found');
    }
  }

  // Deployment Logs operations
  async getDeploymentLogs(buildJobId: string): Promise<DeploymentLog[]> {
    return await db
      .select()
      .from(deploymentLogs)
      .where(eq(deploymentLogs.buildJobId, buildJobId))
      .orderBy(deploymentLogs.timestamp);
  }

  async createDeploymentLog(log: InsertDeploymentLog): Promise<DeploymentLog> {
    const [created] = await db
      .insert(deploymentLogs)
      .values(log)
      .returning();
    return created;
  }

  // Template operations
  async getTemplates(): Promise<Template[]> {
    return await db
      .select()
      .from(templates)
      .orderBy(templates.category, templates.name);
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);
    return template || undefined;
  }

  async getTemplateBySlug(slug: string): Promise<Template | undefined> {
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.slug, slug))
      .limit(1);
    return template || undefined;
  }

  async getTemplateFiles(templateId: string): Promise<TemplateFile[]> {
    return await db
      .select()
      .from(templateFiles)
      .where(eq(templateFiles.templateId, templateId))
      .orderBy(templateFiles.path);
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const [template] = await db
      .insert(templates)
      .values(insertTemplate)
      .returning();
    return template;
  }

  async createTemplateFile(insertFile: InsertTemplateFile): Promise<TemplateFile> {
    const [file] = await db
      .insert(templateFiles)
      .values(insertFile)
      .returning();
    return file;
  }

  // Template Marketplace operations
  async hasUserPurchasedTemplate(userId: string, templateId: string): Promise<boolean> {
    const [purchase] = await db
      .select()
      .from(templatePurchases)
      .where(and(
        eq(templatePurchases.userId, userId),
        eq(templatePurchases.templateId, templateId)
      ))
      .limit(1);
    return !!purchase;
  }

  async createTemplatePurchase(purchase: Omit<InsertTemplatePurchase, 'userId'> & { userId: string }): Promise<TemplatePurchase> {
    const [newPurchase] = await db
      .insert(templatePurchases)
      .values(purchase)
      .returning();
    return newPurchase;
  }

  async getUserTemplatePurchases(userId: string): Promise<TemplatePurchase[]> {
    return await db
      .select()
      .from(templatePurchases)
      .where(eq(templatePurchases.userId, userId))
      .orderBy(desc(templatePurchases.createdAt));
  }

  async incrementTemplateSales(templateId: string, price: number): Promise<void> {
    await db
      .update(templates)
      .set({
        salesCount: sql`${templates.salesCount} + 1`,
        revenue: sql`${templates.revenue} + ${price}`,
        updatedAt: new Date()
      })
      .where(eq(templates.id, templateId));
  }

  async getTemplateReviews(templateId: string): Promise<any[]> {
    const reviews = await db
      .select({
        id: templateReviews.id,
        templateId: templateReviews.templateId,
        userId: templateReviews.userId,
        rating: templateReviews.rating,
        title: templateReviews.title,
        comment: templateReviews.comment,
        isVerifiedPurchase: templateReviews.isVerifiedPurchase,
        helpfulCount: templateReviews.helpfulCount,
        createdAt: templateReviews.createdAt,
        updatedAt: templateReviews.updatedAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userProfileImage: users.profileImageUrl,
      })
      .from(templateReviews)
      .leftJoin(users, eq(templateReviews.userId, users.id))
      .where(eq(templateReviews.templateId, templateId))
      .orderBy(desc(templateReviews.createdAt));
    
    return reviews;
  }

  async createTemplateReview(review: { 
    templateId: string; 
    userId: string; 
    rating: number; 
    title?: string; 
    comment?: string; 
    isVerifiedPurchase: number 
  }): Promise<any> {
    const [newReview] = await db
      .insert(templateReviews)
      .values(review)
      .returning();
    return newReview;
  }

  async updateTemplateReview(
    reviewId: string, 
    userId: string, 
    updates: { rating?: number; title?: string; comment?: string }
  ): Promise<any> {
    const [updated] = await db
      .update(templateReviews)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(templateReviews.id, reviewId),
        eq(templateReviews.userId, userId)
      ))
      .returning();
    
    if (!updated) {
      throw new Error('Review not found or access denied');
    }
    return updated;
  }

  async deleteTemplateReview(reviewId: string, userId: string): Promise<void> {
    await db
      .delete(templateReviews)
      .where(and(
        eq(templateReviews.id, reviewId),
        eq(templateReviews.userId, userId)
      ));
  }

  async incrementReviewHelpful(reviewId: string): Promise<any> {
    const [updated] = await db
      .update(templateReviews)
      .set({ helpfulCount: sql`${templateReviews.helpfulCount} + 1` })
      .where(eq(templateReviews.id, reviewId))
      .returning();
    return updated;
  }

  // Project version operations
  async getProjectVersions(projectId: string, userId: string): Promise<ProjectVersion[]> {
    return await db
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.userId, userId)))
      .orderBy(desc(projectVersions.createdAt));
  }

  async getProjectVersion(versionId: string, userId: string): Promise<ProjectVersion | undefined> {
    const [version] = await db
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.id, versionId), eq(projectVersions.userId, userId)))
      .limit(1);
    return version || undefined;
  }

  async getProjectVersionFiles(versionId: string): Promise<ProjectVersionFile[]> {
    return await db
      .select()
      .from(projectVersionFiles)
      .where(eq(projectVersionFiles.versionId, versionId))
      .orderBy(projectVersionFiles.path);
  }

  async createProjectVersion(insertVersion: InsertProjectVersionWithUser): Promise<ProjectVersion> {
    const [version] = await db
      .insert(projectVersions)
      .values(insertVersion)
      .returning();
    return version;
  }

  async createProjectVersionFile(insertFile: InsertProjectVersionFile): Promise<ProjectVersionFile> {
    const [file] = await db
      .insert(projectVersionFiles)
      .values(insertFile)
      .returning();
    return file;
  }

  async restoreProjectVersion(versionId: string, userId: string): Promise<void> {
    // Get the version to verify ownership
    const version = await this.getProjectVersion(versionId, userId);
    if (!version) {
      throw new Error('Version not found or access denied');
    }

    // Get the version files
    const versionFiles = await this.getProjectVersionFiles(versionId);

    // Delete current project files
    await db
      .delete(files)
      .where(and(eq(files.projectId, version.projectId), eq(files.userId, userId)));

    // Restore files from version
    for (const vFile of versionFiles) {
      await db.insert(files).values({
        userId,
        projectId: version.projectId,
        filename: vFile.path,
        content: vFile.content,
        language: vFile.language,
      });
    }

    // Update project's updatedAt
    await db
      .update(projects)
      .set({ updatedAt: new Date() })
      .where(and(eq(projects.id, version.projectId), eq(projects.userId, userId)));
  }

  // Iterative project operations
  async getProjectFiles(projectId: string, userId?: string): Promise<File[]> {
    const conditions = [eq(files.projectId, projectId)];
    if (userId) {
      conditions.push(eq(files.userId, userId));
    }
    return await db
      .select()
      .from(files)
      .where(and(...conditions))
      .orderBy(files.filename);
  }

  async batchUpdateProjectFiles(
    projectId: string, 
    userId: string, 
    filesToUpdate: Array<{ filename: string; content: string; language: string }>
  ): Promise<File[]> {
    const updatedFiles: File[] = [];

    for (const fileData of filesToUpdate) {
      // Check if file exists
      const [existingFile] = await db
        .select()
        .from(files)
        .where(and(
          eq(files.projectId, projectId),
          eq(files.userId, userId),
          eq(files.filename, fileData.filename)
        ))
        .limit(1);

      if (existingFile) {
        // Update existing file
        const [updated] = await db
          .update(files)
          .set({ 
            content: fileData.content, 
            language: fileData.language,
            updatedAt: new Date() 
          })
          .where(eq(files.id, existingFile.id))
          .returning();
        updatedFiles.push(updated);
      } else {
        // Create new file
        const [created] = await db
          .insert(files)
          .values({
            userId,
            projectId,
            filename: fileData.filename,
            content: fileData.content,
            language: fileData.language,
          })
          .returning();
        updatedFiles.push(created);
      }
    }

    // Update project's updatedAt
    await db
      .update(projects)
      .set({ updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

    return updatedFiles;
  }

  // Lead operations
  async getLeadByEmail(email: string): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.email, email))
      .limit(1);
    return lead || undefined;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db
      .insert(leads)
      .values(insertLead)
      .returning();
    return lead;
  }

  async getAllLeads(): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt));
  }

  async updateLeadStatus(email: string, status: string): Promise<Lead> {
    const [lead] = await db
      .update(leads)
      .set({ status })
      .where(eq(leads.email, email))
      .returning();
    if (!lead) {
      throw new Error('Lead not found');
    }
    return lead;
  }

  // Stripe subscription operations
  async createOrUpdateSubscription(data: {
    userId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    plan: string;
    status: string;
  }): Promise<Subscription> {
    const planLimits = PLAN_LIMITS[data.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Check if subscription exists
    const existing = await this.getSubscription(data.userId);

    if (existing) {
      // Update existing subscription
      const [updated] = await db
        .update(subscriptions)
        .set({
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          plan: data.plan,
          status: data.status,
          aiCreditsRemaining: planLimits.aiCredits,
          currentPeriodStart,
          currentPeriodEnd,
        })
        .where(eq(subscriptions.userId, data.userId))
        .returning();
      return updated;
    } else {
      // Create new subscription
      const [created] = await db
        .insert(subscriptions)
        .values({
          userId: data.userId,
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          plan: data.plan,
          status: data.status,
          aiCreditsRemaining: planLimits.aiCredits,
          currentPeriodStart,
          currentPeriodEnd,
        })
        .returning();
      return created;
    }
  }

  async updateSubscriptionStatus(stripeSubscriptionId: string, status: string): Promise<void> {
    await db
      .update(subscriptions)
      .set({ status })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
  }

  // Team Workspace methods
  async getTeamWorkspaces(userId: string): Promise<TeamWorkspace[]> {
    const workspaces = await db
      .select()
      .from(teamWorkspaces)
      .leftJoin(teamMembers, eq(teamWorkspaces.id, teamMembers.workspaceId))
      .where(eq(teamMembers.userId, userId))
      .orderBy(desc(teamWorkspaces.updatedAt));
    
    return workspaces.map(w => w.team_workspaces);
  }

  async getTeamWorkspace(workspaceId: string, userId: string): Promise<TeamWorkspace | undefined> {
    const member = await this.getTeamMember(workspaceId, userId);
    if (!member) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    const [workspace] = await db
      .select()
      .from(teamWorkspaces)
      .where(eq(teamWorkspaces.id, workspaceId));
    
    return workspace || undefined;
  }

  async createTeamWorkspace(name: string, description: string | undefined, ownerId: string): Promise<TeamWorkspace> {
    const [workspace] = await db
      .insert(teamWorkspaces)
      .values({ name, description, ownerId })
      .returning();

    await db
      .insert(teamMembers)
      .values({
        workspaceId: workspace.id,
        userId: ownerId,
        role: 'owner'
      });

    return workspace;
  }

  async updateTeamWorkspace(workspaceId: string, ownerId: string, name: string, description: string | undefined): Promise<TeamWorkspace> {
    const workspace = await db
      .select()
      .from(teamWorkspaces)
      .where(eq(teamWorkspaces.id, workspaceId))
      .limit(1);

    if (!workspace[0]) {
      throw new Error('Workspace not found');
    }

    if (workspace[0].ownerId !== ownerId) {
      throw new Error('Access denied: Only workspace owner can update workspace');
    }

    const [updated] = await db
      .update(teamWorkspaces)
      .set({ name, description, updatedAt: new Date() })
      .where(eq(teamWorkspaces.id, workspaceId))
      .returning();

    return updated;
  }

  async deleteTeamWorkspace(workspaceId: string, ownerId: string): Promise<void> {
    const workspace = await db
      .select()
      .from(teamWorkspaces)
      .where(eq(teamWorkspaces.id, workspaceId))
      .limit(1);

    if (!workspace[0]) {
      throw new Error('Workspace not found');
    }

    if (workspace[0].ownerId !== ownerId) {
      throw new Error('Access denied: Only workspace owner can delete workspace');
    }

    await db.delete(teamMembers).where(eq(teamMembers.workspaceId, workspaceId));
    await db.delete(teamInvitations).where(eq(teamInvitations.workspaceId, workspaceId));
    await db.delete(teamWorkspaces).where(eq(teamWorkspaces.id, workspaceId));
  }

  // Team Member methods
  async getTeamMembers(workspaceId: string, userId: string): Promise<TeamMember[]> {
    const member = await this.getTeamMember(workspaceId, userId);
    if (!member) {
      throw new Error('Access denied: You are not a member of this workspace');
    }

    return await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.workspaceId, workspaceId))
      .orderBy(teamMembers.joinedAt);
  }

  async getTeamMember(workspaceId: string, userId: string): Promise<TeamMember | undefined> {
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.workspaceId, workspaceId), eq(teamMembers.userId, userId)));
    
    return member || undefined;
  }

  async addTeamMember(workspaceId: string, userId: string, role: string): Promise<TeamMember> {
    const [member] = await db
      .insert(teamMembers)
      .values({ workspaceId, userId, role })
      .returning();
    
    return member;
  }

  async updateTeamMemberRole(workspaceId: string, userId: string, role: string, requesterId: string): Promise<TeamMember> {
    const requester = await this.getTeamMember(workspaceId, requesterId);
    
    if (!requester || (requester.role !== 'owner' && requester.role !== 'editor')) {
      throw new Error('Access denied: Only owners and editors can update member roles');
    }

    const [updated] = await db
      .update(teamMembers)
      .set({ role })
      .where(and(eq(teamMembers.workspaceId, workspaceId), eq(teamMembers.userId, userId)))
      .returning();

    if (!updated) {
      throw new Error('Team member not found');
    }

    return updated;
  }

  async removeTeamMember(workspaceId: string, userId: string, requesterId: string): Promise<void> {
    const requester = await this.getTeamMember(workspaceId, requesterId);
    
    if (!requester || requester.role !== 'owner') {
      throw new Error('Access denied: Only workspace owner can remove members');
    }

    const result = await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.workspaceId, workspaceId), eq(teamMembers.userId, userId)))
      .returning();

    if (result.length === 0) {
      throw new Error('Team member not found');
    }
  }

  async getUserRole(workspaceId: string, userId: string): Promise<string | undefined> {
    const member = await this.getTeamMember(workspaceId, userId);
    return member?.role;
  }

  // Team Invitation methods
  async getTeamInvitations(workspaceId: string, userId: string): Promise<TeamInvitation[]> {
    const member = await this.getTeamMember(workspaceId, userId);
    
    if (!member || (member.role !== 'owner' && member.role !== 'editor')) {
      throw new Error('Access denied: Only owners and editors can view invitations');
    }

    return await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.workspaceId, workspaceId))
      .orderBy(desc(teamInvitations.createdAt));
  }

  async createTeamInvitation(workspaceId: string, invitedEmail: string, role: string, invitedBy: string): Promise<TeamInvitation> {
    const member = await this.getTeamMember(workspaceId, invitedBy);
    
    if (!member || (member.role !== 'owner' && member.role !== 'editor')) {
      throw new Error('Access denied: Only owners and editors can invite members');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invitation] = await db
      .insert(teamInvitations)
      .values({
        workspaceId,
        invitedEmail,
        role,
        invitedBy,
        token,
        expiresAt,
        status: 'pending'
      })
      .returning();

    return invitation;
  }

  async getTeamInvitationByToken(token: string): Promise<TeamInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.token, token));
    
    return invitation || undefined;
  }

  async acceptTeamInvitation(token: string, userId: string): Promise<TeamMember> {
    const invitation = await this.getTeamInvitationByToken(token);
    
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation has already been processed');
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      await db
        .update(teamInvitations)
        .set({ status: 'expired' })
        .where(eq(teamInvitations.token, token));
      throw new Error('Invitation has expired');
    }

    await db
      .update(teamInvitations)
      .set({ status: 'accepted' })
      .where(eq(teamInvitations.token, token));

    const [member] = await db
      .insert(teamMembers)
      .values({
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role
      })
      .returning();

    return member;
  }

  async declineTeamInvitation(token: string): Promise<void> {
    const invitation = await this.getTeamInvitationByToken(token);
    
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation has already been processed');
    }

    await db
      .update(teamInvitations)
      .set({ status: 'declined' })
      .where(eq(teamInvitations.token, token));
  }

  // API Key methods
  async getApiKeys(userId: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async createApiKey(userId: string, name: string, expiresAt: Date | null): Promise<{ key: string; apiKey: ApiKey }> {
    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyPrefix = rawKey.substring(0, 12);
    const hashedKey = await bcrypt.hash(rawKey, 10);

    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        userId,
        name,
        key: hashedKey,
        keyPrefix,
        expiresAt,
        isActive: 1
      })
      .returning();

    return { key: rawKey, apiKey };
  }

  async revokeApiKey(keyId: string, userId: string): Promise<void> {
    const result = await db
      .update(apiKeys)
      .set({ isActive: 0 })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .returning();

    if (result.length === 0) {
      throw new Error('API key not found or access denied');
    }
  }

  async validateApiKey(key: string): Promise<ApiKey | undefined> {
    const allKeys = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.isActive, 1));

    for (const apiKey of allKeys) {
      const isValid = await bcrypt.compare(key, apiKey.key);
      if (isValid) {
        if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
          await db
            .update(apiKeys)
            .set({ isActive: 0 })
            .where(eq(apiKeys.id, apiKey.id));
          return undefined;
        }
        return apiKey;
      }
    }

    return undefined;
  }

  async updateApiKeyLastUsed(keyId: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyId));
  }

  // Support Ticket methods
  async getGitRepository(projectId: string, userId: string): Promise<any | undefined> {
    const [repo] = await db
      .select()
      .from(gitRepositories)
      .where(and(
        eq(gitRepositories.projectId, projectId),
        eq(gitRepositories.userId, userId)
      ));
    
    // SECURITY: Decrypt access token before returning
    if (repo && repo.accessToken) {
      try {
        repo.accessToken = decryptValue(repo.accessToken);
      } catch (error) {
        console.error('[STORAGE] Failed to decrypt git access token:', error);
        // Return repo without token rather than failing completely
        repo.accessToken = null;
      }
    }
    
    return repo;
  }

  async createGitRepository(repo: { 
    projectId: string; 
    userId: string; 
    provider: string; 
    repoUrl: string; 
    repoName: string; 
    branch?: string; 
    accessToken?: string 
  }): Promise<any> {
    // SECURITY: Encrypt access token before storing in database
    // Uses AES-256-GCM with SESSION_SECRET to protect git credentials at rest
    const encryptedToken = repo.accessToken ? encryptValue(repo.accessToken) : null;
    
    const [newRepo] = await db
      .insert(gitRepositories)
      .values({
        ...repo,
        accessToken: encryptedToken,
        syncStatus: 'pending'
      })
      .returning();
    
    // Return the repo with decrypted token for immediate use
    if (newRepo.accessToken) {
      newRepo.accessToken = repo.accessToken; // Use original plaintext
    }
    
    return newRepo;
  }

  async updateGitSyncStatus(projectId: string, userId: string, status: string): Promise<any> {
    const [repo] = await db
      .update(gitRepositories)
      .set({ 
        syncStatus: status, 
        lastSyncedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(and(
        eq(gitRepositories.projectId, projectId),
        eq(gitRepositories.userId, userId)
      ))
      .returning();
    
    if (!repo) {
      throw new Error('Git repository not found');
    }
    return repo;
  }

  async deleteGitRepository(projectId: string, userId: string): Promise<void> {
    await db
      .delete(gitRepositories)
      .where(and(
        eq(gitRepositories.projectId, projectId),
        eq(gitRepositories.userId, userId)
      ));
  }

  async getSupportTickets(userId: string): Promise<SupportTicket[]> {
    return await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async getSupportTicket(ticketId: string, userId: string): Promise<SupportTicket | undefined> {
    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)));
    
    return ticket || undefined;
  }

  async getAllSupportTickets(adminUserId: string): Promise<SupportTicket[]> {
    const admin = await this.getUser(adminUserId);
    
    if (!admin || admin.role !== 'admin') {
      throw new Error('Access denied: Admin privileges required');
    }

    return await db
      .select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));
  }

  async createSupportTicket(userId: string, subject: string, description: string, category: string, priority: string): Promise<SupportTicket> {
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        userId,
        subject,
        description,
        category,
        priority,
        status: 'open'
      })
      .returning();

    return ticket;
  }

  async updateSupportTicketStatus(ticketId: string, status: string, resolvedAt: Date | null): Promise<SupportTicket> {
    const [ticket] = await db
      .update(supportTickets)
      .set({ 
        status, 
        resolvedAt,
        updatedAt: new Date() 
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    return ticket;
  }

  async assignSupportTicket(ticketId: string, assignedTo: string | null): Promise<SupportTicket> {
    const [ticket] = await db
      .update(supportTickets)
      .set({ 
        assignedTo,
        updatedAt: new Date() 
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    return ticket;
  }

  async getSupportTicketMessages(ticketId: string, userId: string): Promise<SupportTicketMessage[]> {
    const ticket = await this.getSupportTicket(ticketId, userId);
    
    if (!ticket) {
      const user = await this.getUser(userId);
      if (!user || user.role !== 'admin') {
        throw new Error('Access denied: You do not have access to this ticket');
      }
    }

    return await db
      .select()
      .from(supportTicketMessages)
      .where(eq(supportTicketMessages.ticketId, ticketId))
      .orderBy(supportTicketMessages.createdAt);
  }

  async createSupportTicketMessage(ticketId: string, userId: string, message: string, isInternal: number): Promise<SupportTicketMessage> {
    const [ticketMessage] = await db
      .insert(supportTicketMessages)
      .values({
        ticketId,
        userId,
        message,
        isInternal
      })
      .returning();

    await db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId));

    return ticketMessage;
  }

  // ============================================================================
  // "BUILD-FOR-ME" CUSTOM SERVICE IMPLEMENTATIONS
  // ============================================================================

  async getServiceRequests(userId: string): Promise<ServiceRequest[]> {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.userId, userId))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async getAllServiceRequests(adminUserId: string): Promise<ServiceRequest[]> {
    const user = await this.getUser(adminUserId);
    if (!user || user.role !== 'admin') {
      throw new Error('Access denied: Admin privileges required');
    }

    return await db
      .select()
      .from(serviceRequests)
      .orderBy(desc(serviceRequests.createdAt));
  }

  async getServiceRequest(requestId: string, userId: string): Promise<ServiceRequest | undefined> {
    const [request] = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId));

    if (!request) return undefined;

    const user = await this.getUser(userId);
    if (request.userId !== userId && (!user || user.role !== 'admin')) {
      throw new Error('Access denied: You do not have access to this request');
    }

    return request;
  }

  async createServiceRequest(request: Omit<InsertServiceRequest, 'userId'> & { userId: string }): Promise<ServiceRequest> {
    const [newRequest] = await db
      .insert(serviceRequests)
      .values(request)
      .returning();

    return newRequest;
  }

  async updateServiceRequestStatus(requestId: string, status: string): Promise<ServiceRequest> {
    const [updated] = await db
      .update(serviceRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(serviceRequests.id, requestId))
      .returning();

    if (!updated) {
      throw new Error('Service request not found');
    }

    return updated;
  }

  async updateServiceRequestPayment(
    requestId: string, 
    paymentType: 'deposit' | 'final', 
    stripePaymentId: string, 
    amount: string
  ): Promise<ServiceRequest> {
    const updates: any = { updatedAt: new Date() };

    if (paymentType === 'deposit') {
      updates.depositPaid = 1;
      updates.depositStripeId = stripePaymentId;
      updates.totalPaid = sql`${serviceRequests.totalPaid} + ${amount}`;
      updates.status = 'deposit_paid';
    } else {
      updates.finalPaymentPaid = 1;
      updates.finalPaymentStripeId = stripePaymentId;
      updates.totalPaid = sql`${serviceRequests.totalPaid} + ${amount}`;
      updates.status = 'completed';
      updates.exportReady = 1;
    }

    const [updated] = await db
      .update(serviceRequests)
      .set(updates)
      .where(eq(serviceRequests.id, requestId))
      .returning();

    if (!updated) {
      throw new Error('Service request not found');
    }

    return updated;
  }

  async assignServiceRequest(requestId: string, adminId: string): Promise<ServiceRequest> {
    const [updated] = await db
      .update(serviceRequests)
      .set({ 
        assignedToAdminId: adminId,
        status: 'in_progress',
        updatedAt: new Date() 
      })
      .where(eq(serviceRequests.id, requestId))
      .returning();

    if (!updated) {
      throw new Error('Service request not found');
    }

    return updated;
  }

  async updateServiceRequestPreview(
    requestId: string, 
    previewProjectId: string, 
    previewUrl: string
  ): Promise<ServiceRequest> {
    const [updated] = await db
      .update(serviceRequests)
      .set({ 
        previewProjectId, 
        previewUrl,
        updatedAt: new Date() 
      })
      .where(eq(serviceRequests.id, requestId))
      .returning();

    if (!updated) {
      throw new Error('Service request not found');
    }

    return updated;
  }

  async getServiceMessages(requestId: string): Promise<ServiceMessage[]> {
    return await db
      .select()
      .from(serviceMessages)
      .where(eq(serviceMessages.requestId, requestId))
      .orderBy(serviceMessages.createdAt);
  }

  async createServiceMessage(message: Omit<InsertServiceMessage, 'senderId'> & { senderId: string }): Promise<ServiceMessage> {
    const [newMessage] = await db
      .insert(serviceMessages)
      .values(message)
      .returning();

    await db
      .update(serviceRequests)
      .set({ updatedAt: new Date() })
      .where(eq(serviceRequests.id, message.requestId));

    return newMessage;
  }

  async markServiceMessagesRead(requestId: string, userId: string): Promise<void> {
    await db
      .update(serviceMessages)
      .set({ isRead: 1 })
      .where(
        and(
          eq(serviceMessages.requestId, requestId),
          sql`${serviceMessages.senderId} != ${userId}`
        )
      );
  }

  async getServiceMilestones(requestId: string): Promise<ServiceMilestone[]> {
    return await db
      .select()
      .from(serviceMilestones)
      .where(eq(serviceMilestones.requestId, requestId))
      .orderBy(serviceMilestones.createdAt);
  }

  async createServiceMilestone(milestone: InsertServiceMilestone): Promise<ServiceMilestone> {
    const [newMilestone] = await db
      .insert(serviceMilestones)
      .values(milestone)
      .returning();

    return newMilestone;
  }

  async updateServiceMilestoneStatus(
    milestoneId: string, 
    status: string, 
    isPaid: number, 
    stripePaymentId?: string
  ): Promise<ServiceMilestone> {
    const updates: any = { status, isPaid };
    
    if (stripePaymentId) {
      updates.stripePaymentId = stripePaymentId;
      updates.paidAt = new Date();
    }

    const [updated] = await db
      .update(serviceMilestones)
      .set(updates)
      .where(eq(serviceMilestones.id, milestoneId))
      .returning();

    if (!updated) {
      throw new Error('Service milestone not found');
    }

    return updated;
  }

  async getServiceProgressLogs(requestId: string): Promise<ServiceProgressLog[]> {
    return await db
      .select()
      .from(serviceProgressLogs)
      .where(eq(serviceProgressLogs.requestId, requestId))
      .orderBy(desc(serviceProgressLogs.createdAt));
  }

  async createServiceProgressLog(log: InsertServiceProgressLog): Promise<ServiceProgressLog> {
    const [newLog] = await db
      .insert(serviceProgressLogs)
      .values(log)
      .returning();

    await db
      .update(serviceRequests)
      .set({ updatedAt: new Date() })
      .where(eq(serviceRequests.id, log.requestId));

    return newLog;
  }

  // Project Version/Snapshot operations (Rollback feature)
  async createProjectSnapshot(
    projectId: string,
    userId: string,
    label: string,
    description?: string
  ): Promise<ProjectVersion> {
    // Get all current files for the project
    const currentFiles = await db
      .select()
      .from(files)
      .where(and(eq(files.projectId, projectId), eq(files.userId, userId)));

    // Create version/snapshot
    const [version] = await db
      .insert(projectVersions)
      .values({
        projectId,
        userId,
        label,
        description,
        metadata: { fileCount: currentFiles.length }
      })
      .returning();

    // Store snapshot of all files
    if (currentFiles.length > 0) {
      const versionFiles = currentFiles.map(file => ({
        versionId: version.id,
        path: file.path ? `${file.path}${file.filename}` : file.filename,
        content: file.content,
        language: file.language
      }));

      await db.insert(projectVersionFiles).values(versionFiles);
    }

    console.log(`✅ Created snapshot "${label}" for project ${projectId} with ${currentFiles.length} files`);
    return version;
  }

  async getProjectSnapshots(projectId: string, userId: string): Promise<ProjectVersion[]> {
    return await db
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.userId, userId)))
      .orderBy(desc(projectVersions.createdAt));
  }

  async rollbackToSnapshot(projectId: string, snapshotId: string, userId: string): Promise<void> {
    // Verify snapshot exists and belongs to user
    const [snapshot] = await db
      .select()
      .from(projectVersions)
      .where(
        and(
          eq(projectVersions.id, snapshotId),
          eq(projectVersions.projectId, projectId),
          eq(projectVersions.userId, userId)
        )
      );

    if (!snapshot) {
      throw new Error('Snapshot not found or access denied');
    }

    // Get all files from the snapshot
    const snapshotFiles = await db
      .select()
      .from(projectVersionFiles)
      .where(eq(projectVersionFiles.versionId, snapshotId));

    // Delete all current files for the project
    await db
      .delete(files)
      .where(and(eq(files.projectId, projectId), eq(files.userId, userId)));

    // Restore files from snapshot
    if (snapshotFiles.length > 0) {
      const restoredFiles = snapshotFiles.map(file => {
        // Parse path to extract folder and filename
        const lastSlash = file.path.lastIndexOf('/');
        const filename = lastSlash >= 0 ? file.path.substring(lastSlash + 1) : file.path;
        const folderPath = lastSlash >= 0 ? file.path.substring(0, lastSlash + 1) : '';

        return {
          userId,
          projectId,
          filename,
          path: folderPath,
          content: file.content,
          language: file.language
        };
      });

      await db.insert(files).values(restoredFiles);
    }

    console.log(`✅ Rolled back project ${projectId} to snapshot "${snapshot.label}" (${snapshotFiles.length} files restored)`);
  }

  // Satisfaction Survey methods
  async createSatisfactionSurvey(survey: InsertSatisfactionSurvey): Promise<SatisfactionSurvey> {
    const [result] = await db.insert(satisfactionSurveys).values(survey).returning();
    return result;
  }

  async getSatisfactionStats(): Promise<any> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Overall stats
    const totalSurveys = await db
      .select({ count: sql<number>`count(*)` })
      .from(satisfactionSurveys)
      .where(sql`created_at >= ${thirtyDaysAgo}`);

    const avgRating = await db
      .select({ avg: sql<number>`avg(rating)` })
      .from(satisfactionSurveys)
      .where(sql`created_at >= ${thirtyDaysAgo}`);

    const categoryBreakdown = await db
      .select({
        category: satisfactionSurveys.category,
        count: sql<number>`count(*)`,
        avgRating: sql<number>`avg(rating)`,
      })
      .from(satisfactionSurveys)
      .where(sql`created_at >= ${thirtyDaysAgo}`)
      .groupBy(satisfactionSurveys.category);

    const ratingDistribution = await db
      .select({
        rating: satisfactionSurveys.rating,
        count: sql<number>`count(*)`,
      })
      .from(satisfactionSurveys)
      .where(sql`created_at >= ${thirtyDaysAgo}`)
      .groupBy(satisfactionSurveys.rating)
      .orderBy(satisfactionSurveys.rating);

    return {
      totalSurveys: Number(totalSurveys[0]?.count || 0),
      averageRating: Number(avgRating[0]?.avg || 0).toFixed(2),
      categoryBreakdown,
      ratingDistribution,
    };
  }

  // Healing Target methods
  async getHealingTargets(userId: string): Promise<HealingTarget[]> {
    return await db
      .select()
      .from(healingTargets)
      .where(eq(healingTargets.userId, userId))
      .orderBy(desc(healingTargets.updatedAt));
  }

  async getHealingTarget(id: string, userId: string): Promise<HealingTarget | undefined> {
    const [target] = await db
      .select()
      .from(healingTargets)
      .where(and(eq(healingTargets.id, id), eq(healingTargets.userId, userId)));
    return target || undefined;
  }

  async createHealingTarget(target: InsertHealingTarget & { userId: string }): Promise<HealingTarget> {
    const [created] = await db.insert(healingTargets).values(target).returning();
    return created;
  }

  // Healing Conversation methods
  async getHealingConversations(targetId: string, userId: string): Promise<HealingConversation[]> {
    return await db
      .select()
      .from(healingConversations)
      .where(and(eq(healingConversations.targetId, targetId), eq(healingConversations.userId, userId)))
      .orderBy(desc(healingConversations.updatedAt));
  }

  async getHealingConversation(id: string): Promise<HealingConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(healingConversations)
      .where(eq(healingConversations.id, id));
    return conversation || undefined;
  }

  async createHealingConversation(conversation: InsertHealingConversation & { userId: string }): Promise<HealingConversation> {
    const [created] = await db.insert(healingConversations).values(conversation).returning();
    return created;
  }

  async updateHealingConversation(id: string, updates: Partial<HealingConversation>): Promise<HealingConversation> {
    const [updated] = await db
      .update(healingConversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(healingConversations.id, id))
      .returning();
    if (!updated) {
      throw new Error('Conversation not found');
    }
    return updated;
  }

  // Healing Message methods
  async getHealingMessages(conversationId: string): Promise<HealingMessage[]> {
    return await db
      .select()
      .from(healingMessages)
      .where(eq(healingMessages.conversationId, conversationId))
      .orderBy(healingMessages.createdAt);
  }

  async createHealingMessage(message: InsertHealingMessage): Promise<HealingMessage> {
    const [created] = await db.insert(healingMessages).values(message).returning();
    return created;
  }

  async clearHealingMessages(conversationId: string): Promise<void> {
    await db
      .delete(healingMessages)
      .where(eq(healingMessages.conversationId, conversationId));
  }
  
  // Conversation State operations (context tracking)
  async getConversationState(userId: string, projectId: string | null): Promise<ConversationState | null> {
    const query = projectId
      ? and(eq(conversationStates.userId, userId), eq(conversationStates.projectId, projectId))
      : and(eq(conversationStates.userId, userId), isNull(conversationStates.projectId));

    const [state] = await db
      .select()
      .from(conversationStates)
      .where(query)
      .orderBy(desc(conversationStates.lastUpdated))
      .limit(1);

    return state || null;
  }

  async createConversationState(state: InsertConversationState & { userId: string }): Promise<ConversationState> {
    const [created] = await db
      .insert(conversationStates)
      .values(state as any)
      .returning();
    return created;
  }

  async updateConversationState(id: string, updates: Partial<ConversationState>): Promise<ConversationState> {
    const [updated] = await db
      .update(conversationStates)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(eq(conversationStates.id, id))
      .returning();
    return updated;
  }

  async clearConversationState(id: string): Promise<ConversationState> {
    const [cleared] = await db
      .update(conversationStates)
      .set({
        currentGoal: null,
        mentionedFiles: [],
        sessionSummary: null,
        context: {},
        lastUpdated: new Date(),
      })
      .where(eq(conversationStates.id, id))
      .returning();
    return cleared;
  }

  // Project Folder operations
  async getProjectFolders(projectId: string, userId: string): Promise<ProjectFolder[]> {
    const folders = await db
      .select()
      .from(projectFolders)
      .where(and(eq(projectFolders.projectId, projectId), eq(projectFolders.userId, userId)))
      .orderBy(projectFolders.path);
    return folders;
  }

  async getProjectFolder(id: string, userId: string): Promise<ProjectFolder | undefined> {
    const [folder] = await db
      .select()
      .from(projectFolders)
      .where(and(eq(projectFolders.id, id), eq(projectFolders.userId, userId)));
    return folder;
  }

  async createProjectFolder(folder: InsertProjectFolderWithUser): Promise<ProjectFolder> {
    const [created] = await db
      .insert(projectFolders)
      .values(folder)
      .returning();
    return created;
  }

  async updateProjectFolder(id: string, userId: string, name: string): Promise<ProjectFolder> {
    const [updated] = await db
      .update(projectFolders)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(projectFolders.id, id), eq(projectFolders.userId, userId)))
      .returning();
    return updated;
  }

  async deleteProjectFolder(id: string, userId: string): Promise<void> {
    // Get the folder to be deleted
    const folder = await this.getProjectFolder(id, userId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Delete all child folders (cascade)
    await db
      .delete(projectFolders)
      .where(
        and(
          eq(projectFolders.userId, userId),
          sql`${projectFolders.path} LIKE ${folder.path + '/%'}`
        )
      );

    // Delete all files in this folder and child folders
    await db
      .delete(files)
      .where(
        and(
          eq(files.userId, userId),
          sql`${files.path} LIKE ${folder.path + '%'}`
        )
      );

    // Delete the folder itself
    await db.delete(projectFolders).where(eq(projectFolders.id, id));
  }

  // File Upload operations
  async getFileUploads(projectId: string, userId: string): Promise<FileUpload[]> {
    const uploads = await db
      .select()
      .from(fileUploads)
      .where(and(eq(fileUploads.projectId, projectId), eq(fileUploads.userId, userId)))
      .orderBy(desc(fileUploads.createdAt));
    return uploads;
  }

  async getFileUpload(id: string, userId: string): Promise<FileUpload | undefined> {
    const [upload] = await db
      .select()
      .from(fileUploads)
      .where(and(eq(fileUploads.id, id), eq(fileUploads.userId, userId)));
    return upload;
  }

  async createFileUpload(upload: InsertFileUploadWithUser): Promise<FileUpload> {
    const [created] = await db
      .insert(fileUploads)
      .values(upload)
      .returning();
    return created;
  }

  async deleteFileUpload(id: string, userId: string): Promise<void> {
    await db
      .delete(fileUploads)
      .where(and(eq(fileUploads.id, id), eq(fileUploads.userId, userId)));
  }

  // File operations
  async moveFile(fileId: string, userId: string, folderId: string | null): Promise<File> {
    const [updated] = await db
      .update(files)
      .set({ folderId, updatedAt: new Date() })
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .returning();
    return updated;
  }

  async renameFile(fileId: string, userId: string, filename: string): Promise<File> {
    const [updated] = await db
      .update(files)
      .set({ filename, updatedAt: new Date() })
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .returning();
    return updated;
  }

  async bulkDeleteFiles(fileIds: string[], userId: string): Promise<void> {
    // Delete files in batches to avoid SQL statement size limits
    const batchSize = 100;
    for (let i = 0; i < fileIds.length; i += batchSize) {
      const batch = fileIds.slice(i, i + batchSize);
      await db
        .delete(files)
        .where(
          and(
            eq(files.userId, userId),
            sql`${files.id} IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})`
          )
        );
    }
  }

  // Terminal History operations
  async createTerminalHistory(history: InsertTerminalHistory): Promise<TerminalHistory> {
    const [created] = await db
      .insert(terminalHistory)
      .values(history)
      .returning();
    return created;
  }

  async updateTerminalHistory(
    projectId: string,
    userId: string,
    command: string,
    output: string,
    exitCode: number
  ): Promise<void> {
    // Find the most recent matching command and update it
    await db
      .update(terminalHistory)
      .set({ output, exitCode })
      .where(
        and(
          eq(terminalHistory.projectId, projectId),
          eq(terminalHistory.userId, userId),
          eq(terminalHistory.command, command)
        )
      );
  }

  async getTerminalHistory(
    projectId: string,
    userId: string,
    limit: number = 50
  ): Promise<TerminalHistory[]> {
    return await db
      .select()
      .from(terminalHistory)
      .where(
        and(
          eq(terminalHistory.projectId, projectId),
          eq(terminalHistory.userId, userId)
        )
      )
      .orderBy(desc(terminalHistory.executedAt))
      .limit(limit);
  }

  // Project Migration operations
  async getProjectMigrations(projectId: string, userId: string): Promise<ProjectMigration[]> {
    return await db
      .select()
      .from(projectMigrations)
      .where(
        and(
          eq(projectMigrations.projectId, projectId),
          eq(projectMigrations.userId, userId)
        )
      )
      .orderBy(desc(projectMigrations.createdAt));
  }

  async getProjectMigration(id: string, userId: string): Promise<ProjectMigration | undefined> {
    const [migration] = await db
      .select()
      .from(projectMigrations)
      .where(
        and(
          eq(projectMigrations.id, id),
          eq(projectMigrations.userId, userId)
        )
      );
    return migration || undefined;
  }

  async createProjectMigration(migration: InsertProjectMigration & { userId: string }): Promise<ProjectMigration> {
    const [created] = await db
      .insert(projectMigrations)
      .values(migration)
      .returning();
    return created;
  }

  async updateMigrationStatus(id: string, status: string, appliedAt?: Date): Promise<ProjectMigration> {
    const [updated] = await db
      .update(projectMigrations)
      .set({ 
        status, 
        appliedAt: appliedAt || (status === 'applied' ? new Date() : undefined) 
      })
      .where(eq(projectMigrations.id, id))
      .returning();
    return updated;
  }

  async getAppliedMigrations(projectId: string, userId: string): Promise<ProjectMigration[]> {
    return await db
      .select()
      .from(projectMigrations)
      .where(
        and(
          eq(projectMigrations.projectId, projectId),
          eq(projectMigrations.userId, userId),
          eq(projectMigrations.status, 'applied')
        )
      )
      .orderBy(desc(projectMigrations.appliedAt));
  }
}

export const storage = new DatabaseStorage();
