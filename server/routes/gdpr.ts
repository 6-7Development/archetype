/**
 * GDPR Data Export Routes
 * Endpoints for GDPR compliance (data access, portability rights)
 */

import { Router, Request, Response } from 'express';
import { GDPRExportService } from '../services/gdprExportService';
import { AuditService } from '../services/auditService';
import { isAuthenticated } from '../universalAuth';

const router = Router();

/**
 * GET /api/gdpr/export
 * Generate user data export for GDPR compliance
 *
 * Query Parameters:
 * - workspaceId: (optional) Filter export to specific workspace
 * - format: (optional) 'json' (default) or 'csv'
 *
 * Returns: JSON or CSV file with user's personal data
 * Logs: Audit entry with action 'gdpr.data_export'
 */
router.get('/export', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authenticatedUserId;
    const workspaceId = req.query.workspaceId as string | undefined;
    const format = (req.query.format as string) || 'json';

    // Validate userId
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    // If workspaceId specified, verify user is member of that workspace
    if (workspaceId) {
      const { db } = await import('../db');
      const { teamMembers, teamWorkspaces } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const [member] = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.userId, userId), eq(teamMembers.workspaceId, workspaceId)));

      if (!member) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this workspace',
        });
      }
    }

    // Generate export
    const exportData = await GDPRExportService.generateUserDataExport(userId, workspaceId);

    // Log export action to audit logs
    if (workspaceId) {
      await AuditService.log({
        workspaceId,
        userId,
        action: 'gdpr.data_export',
        resourceType: 'gdpr',
        resourceId: userId,
        status: 'success',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    // Set response headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `gdpr-export-${timestamp}.${format === 'csv' ? 'csv' : 'json'}`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('X-Export-Date', exportData.exportDate);

    if (format === 'csv') {
      // Convert to CSV format
      const csvContent = convertToCSV(exportData);
      res.send(csvContent);
    } else {
      // Return JSON (pretty-printed)
      res.json(exportData);
    }
  } catch (error) {
    console.error('[GDPR] Export error:', error);

    // Log failed export attempt
    const userId = (req as any).authenticatedUserId;
    const workspaceId = (req as any).workspaceId;

    if (userId && workspaceId) {
      try {
        await AuditService.log({
          workspaceId,
          userId,
          action: 'gdpr.data_export',
          resourceType: 'gdpr',
          resourceId: userId,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (auditError) {
        console.error('[GDPR] Error logging failed export:', auditError);
      }
    }

    res.status(500).json({
      error: 'Export failed',
      message: error instanceof Error ? error.message : 'Failed to generate data export',
    });
  }
});

/**
 * Helper function to convert export data to CSV format
 */
function convertToCSV(data: any): string {
  const lines: string[] = [];

  // Header with export metadata
  lines.push('GDPR DATA EXPORT REPORT');
  lines.push(`Generated: ${data.exportDate}`);
  lines.push('');

  // User Information Section
  lines.push('=== USER PROFILE ===');
  lines.push(formatCSVRow(['Field', 'Value']));
  lines.push(formatCSVRow(['User ID', data.user.id]));
  lines.push(formatCSVRow(['Email', data.user.email]));
  lines.push(formatCSVRow(['First Name', data.user.firstName || 'N/A']));
  lines.push(formatCSVRow(['Last Name', data.user.lastName || 'N/A']));
  lines.push(formatCSVRow(['Role', data.user.role]));
  lines.push(formatCSVRow(['Account Created', data.user.createdAt]));
  lines.push('');

  // Summary Section
  lines.push('=== DATA SUMMARY ===');
  lines.push(formatCSVRow(['Metric', 'Count']));
  lines.push(formatCSVRow(['Total Files', data.summary.totalFiles]));
  lines.push(formatCSVRow(['Total Chat Messages', data.summary.totalMessages]));
  lines.push(formatCSVRow(['Total Projects', data.summary.totalProjects]));
  lines.push(formatCSVRow(['Total Workspaces', data.summary.totalWorkspaces]));
  lines.push(formatCSVRow(['Total Audit Log Entries', data.summary.totalAuditLogEntries]));
  lines.push('');

  // Files Section
  if (data.files.length > 0) {
    lines.push('=== FILES ===');
    lines.push(
      formatCSVRow([
        'File ID',
        'Filename',
        'Path',
        'Project ID',
        'Language',
        'Created At',
        'Updated At',
      ])
    );
    data.files.forEach((file: any) => {
      lines.push(
        formatCSVRow([
          file.id,
          file.filename,
          file.path,
          file.projectId || '',
          file.language,
          file.createdAt,
          file.updatedAt,
        ])
      );
    });
    lines.push('');
  }

  // Projects Section
  if (data.projects.length > 0) {
    lines.push('=== PROJECTS ===');
    lines.push(
      formatCSVRow(['Project ID', 'Name', 'Type', 'Status', 'Created At', 'Updated At'])
    );
    data.projects.forEach((project: any) => {
      lines.push(
        formatCSVRow([
          project.id,
          project.name,
          project.type,
          project.status,
          project.createdAt,
          project.updatedAt,
        ])
      );
    });
    lines.push('');
  }

  // Chat Messages Summary
  if (data.chatMessages.length > 0) {
    lines.push('=== CHAT MESSAGES ===');
    lines.push(formatCSVRow(['Message ID', 'Role', 'Project ID', 'Created At']));
    data.chatMessages.slice(0, 100).forEach((msg: any) => {
      const preview = msg.content.substring(0, 50).replace(/"/g, '""');
      lines.push(
        formatCSVRow([
          msg.id,
          msg.role,
          msg.projectId || '',
          msg.createdAt,
          `"${preview}..."`,
        ])
      );
    });
    if (data.chatMessages.length > 100) {
      lines.push(formatCSVRow(['...', `+${data.chatMessages.length - 100} more messages`, '', '']));
    }
    lines.push('');
  }

  // Workspaces Section
  if (data.workspaces.length > 0) {
    lines.push('=== WORKSPACES ===');
    lines.push(
      formatCSVRow(['Workspace ID', 'Name', 'Role', 'Joined At', 'Workspace Created At'])
    );
    data.workspaces.forEach((ws: any) => {
      lines.push(
        formatCSVRow([
          ws.workspace.id,
          ws.workspace.name,
          ws.role,
          ws.joinedAt,
          ws.workspace.createdAt,
        ])
      );
    });
    lines.push('');
  }

  // Footer
  lines.push('');
  lines.push('---');
  lines.push('This export contains your personal data as per GDPR Article 15 (Right of Access)');
  lines.push('For detailed chat messages and file contents, please use the JSON export format');
  lines.push(`Exported on: ${new Date().toISOString()}`);

  return lines.join('\n');
}

/**
 * Helper to format CSV row
 */
function formatCSVRow(fields: (string | number | boolean | Date | null | undefined)[]): string {
  return fields
    .map((field) => {
      if (field === null || field === undefined) return '';
      const str = field.toString();
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
    .join(',');
}

/**
 * Export function to register routes
 */
export function registerGdprRoutes(app: any): void {
  app.use('/api/gdpr', router);
}
