/**
 * GDPR Data Export Service
 * Generates comprehensive personal data exports for users
 * Complies with GDPR Article 15 (Right to Access) and Article 20 (Data Portability)
 */

import { db } from '../db';
import {
  users,
  files,
  chatMessages,
  auditLogs,
  projects,
  teamMembers,
  teamWorkspaces,
  architectConsultations,
  lomuJobs,
  usageLogs,
  userPreferences,
  userAvatarState,
  terminalHistory,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface GDPRDataExport {
  exportDate: string;
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
    role: string;
    autonomyLevel: string;
    billingStatus: string;
    createdAt: Date;
    updatedAt: Date;
  };
  preferences?: {
    aiModel?: string | null;
    theme?: string | null;
    avatarState?: {
      currentMood: string;
      autoMoodEnabled: boolean;
      customMessage?: string | null;
      particlePreference: string;
    } | null;
  };
  files: Array<{
    id: string;
    filename: string;
    path: string;
    projectId?: string | null;
    language: string;
    createdAt: Date;
    updatedAt: Date;
    contentPreview?: string; // First 500 chars of content
  }>;
  projects: Array<{
    id: string;
    name: string;
    description?: string | null;
    type: string;
    status: string;
    repoUrl?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  chatMessages: Array<{
    id: string;
    projectId?: string | null;
    role: string;
    content: string;
    toolName?: string | null;
    createdAt: Date;
  }>;
  consultations: Array<{
    id: string;
    question: string;
    status: string;
    guidance?: string | null;
    tokensUsed: number;
    createdAt: Date;
    completedAt?: Date | null;
  }>;
  jobs: Array<{
    id: string;
    status: string;
    lastIteration: number;
    error?: string | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date | null;
  }>;
  usageLogs: Array<{
    id: string;
    type: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: string;
    createdAt: Date;
  }>;
  terminalHistory: Array<{
    id: string;
    projectId: string;
    command: string;
    exitCode?: number | null;
    executedAt: Date;
  }>;
  workspaces: Array<{
    workspace: {
      id: string;
      name: string;
      description?: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    role: string;
    joinedAt: Date;
  }>;
  auditLogs: Array<{
    id: string;
    workspaceId: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    status: string;
    createdAt: Date;
  }>;
  summary: {
    totalFiles: number;
    totalMessages: number;
    totalProjects: number;
    totalWorkspaces: number;
    totalAuditLogEntries: number;
    estimatedDataSizeKB: number;
  };
}

export class GDPRExportService {
  /**
   * Generate comprehensive user data export
   * Fetches all personal data accessible to the user
   */
  static async generateUserDataExport(userId: string, workspaceId?: string): Promise<GDPRDataExport> {
    const exportDate = new Date();
    const exportDateISO = exportDate.toISOString();

    try {
      // Fetch user profile (SENSITIVE: Excluding password hash)
      const [userRecord] = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          autonomyLevel: users.autonomyLevel,
          billingStatus: users.billingStatus,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!userRecord) {
        throw new Error(`User not found: ${userId}`);
      }

      // Fetch user preferences
      const [preferences] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId));

      const [avatarState] = await db
        .select()
        .from(userAvatarState)
        .where(eq(userAvatarState.userId, userId));

      // Fetch all files owned by user
      const fileRecords = await db
        .select({
          id: files.id,
          filename: files.filename,
          path: files.path,
          projectId: files.projectId,
          language: files.language,
          createdAt: files.createdAt,
          updatedAt: files.updatedAt,
          // Note: Full content stored in database but not exported in preview for privacy
          // To export full content, use separate endpoint
        })
        .from(files)
        .where(eq(files.userId, userId));

      // Fetch all projects owned by user
      const projectRecords = await db
        .select()
        .from(projects)
        .where(eq(projects.userId, userId));

      // Fetch all chat messages for user
      const chatMessageRecords = await db
        .select({
          id: chatMessages.id,
          projectId: chatMessages.projectId,
          role: chatMessages.role,
          content: chatMessages.content,
          toolName: chatMessages.toolName,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .where(eq(chatMessages.userId, userId));

      // Fetch architect consultations
      const consultationRecords = await db
        .select({
          id: architectConsultations.id,
          question: architectConsultations.question,
          status: architectConsultations.status,
          guidance: architectConsultations.guidance,
          tokensUsed: architectConsultations.tokensUsed,
          createdAt: architectConsultations.createdAt,
          completedAt: architectConsultations.completedAt,
        })
        .from(architectConsultations)
        .where(eq(architectConsultations.userId, userId));

      // Fetch LomuAI jobs
      const jobRecords = await db
        .select({
          id: lomuJobs.id,
          status: lomuJobs.status,
          lastIteration: lomuJobs.lastIteration,
          error: lomuJobs.error,
          createdAt: lomuJobs.createdAt,
          updatedAt: lomuJobs.updatedAt,
          completedAt: lomuJobs.completedAt,
        })
        .from(lomuJobs)
        .where(eq(lomuJobs.userId, userId));

      // Fetch usage logs
      const usageLogRecords = await db
        .select({
          id: usageLogs.id,
          type: usageLogs.type,
          inputTokens: usageLogs.inputTokens,
          outputTokens: usageLogs.outputTokens,
          totalTokens: usageLogs.totalTokens,
          cost: usageLogs.cost,
          createdAt: usageLogs.createdAt,
        })
        .from(usageLogs)
        .where(eq(usageLogs.userId, userId));

      // Fetch terminal history
      const terminalRecords = await db
        .select({
          id: terminalHistory.id,
          projectId: terminalHistory.projectId,
          command: terminalHistory.command,
          exitCode: terminalHistory.exitCode,
          executedAt: terminalHistory.executedAt,
        })
        .from(terminalHistory)
        .where(eq(terminalHistory.userId, userId));

      // Fetch workspace memberships with workspace details
      const memberRecords = await db
        .select({
          memberId: teamMembers.id,
          workspaceId: teamMembers.workspaceId,
          role: teamMembers.role,
          joinedAt: teamMembers.joinedAt,
        })
        .from(teamMembers)
        .where(eq(teamMembers.userId, userId));

      const workspacesList = [];
      for (const member of memberRecords) {
        // If workspaceId filter provided, only include that workspace
        if (workspaceId && member.workspaceId !== workspaceId) {
          continue;
        }

        const [workspace] = await db
          .select()
          .from(teamWorkspaces)
          .where(eq(teamWorkspaces.id, member.workspaceId));

        if (workspace) {
          workspacesList.push({
            workspace: {
              id: workspace.id,
              name: workspace.name,
              description: workspace.description,
              createdAt: workspace.createdAt,
              updatedAt: workspace.updatedAt,
            },
            role: member.role,
            joinedAt: member.joinedAt,
          });
        }
      }

      // Fetch audit logs for user (only audit entries where user_id matches)
      // Audit logs are workspace-scoped, so filter by workspace if provided
      let auditLogRecords = [];
      if (workspaceId) {
        auditLogRecords = await db
          .select({
            id: auditLogs.id,
            workspaceId: auditLogs.workspaceId,
            action: auditLogs.action,
            resourceType: auditLogs.resourceType,
            resourceId: auditLogs.resourceId,
            status: auditLogs.status,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .where(and(eq(auditLogs.userId, userId), eq(auditLogs.workspaceId, workspaceId)));
      } else {
        // Get all audit logs for this user across all workspaces
        auditLogRecords = await db
          .select({
            id: auditLogs.id,
            workspaceId: auditLogs.workspaceId,
            action: auditLogs.action,
            resourceType: auditLogs.resourceType,
            resourceId: auditLogs.resourceId,
            status: auditLogs.status,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .where(eq(auditLogs.userId, userId));
      }

      // Calculate estimated data size
      const estimatedSize = this.estimateDataSize({
        files: fileRecords.length,
        chatMessages: chatMessageRecords.length,
        auditLogs: auditLogRecords.length,
        projects: projectRecords.length,
      });

      // Build export object
      const exportData: GDPRDataExport = {
        exportDate: exportDateISO,
        user: userRecord,
        preferences: {
          aiModel: preferences?.aiModel,
          theme: preferences?.theme,
          avatarState: avatarState
            ? {
                currentMood: avatarState.currentMood,
                autoMoodEnabled: avatarState.autoMoodEnabled,
                customMessage: avatarState.customMessage,
                particlePreference: avatarState.particlePreference,
              }
            : null,
        },
        files: fileRecords,
        projects: projectRecords,
        chatMessages: chatMessageRecords,
        consultations: consultationRecords,
        jobs: jobRecords,
        usageLogs: usageLogRecords,
        terminalHistory: terminalRecords,
        workspaces: workspacesList,
        auditLogs: auditLogRecords,
        summary: {
          totalFiles: fileRecords.length,
          totalMessages: chatMessageRecords.length,
          totalProjects: projectRecords.length,
          totalWorkspaces: workspacesList.length,
          totalAuditLogEntries: auditLogRecords.length,
          estimatedDataSizeKB: estimatedSize,
        },
      };

      return exportData;
    } catch (error) {
      console.error('[GDPR] Error generating data export:', error);
      throw error;
    }
  }

  /**
   * Estimate data size in KB
   */
  private static estimateDataSize(counts: {
    files: number;
    chatMessages: number;
    auditLogs: number;
    projects: number;
  }): number {
    // Rough estimates per record type (in KB)
    const perFile = 2; // avg file metadata
    const perMessage = 3; // avg chat message
    const perAuditLog = 1; // avg audit log
    const perProject = 1; // avg project metadata
    const overhead = 50; // JSON structure overhead

    return (
      counts.files * perFile +
      counts.chatMessages * perMessage +
      counts.auditLogs * perAuditLog +
      counts.projects * perProject +
      overhead
    );
  }
}
