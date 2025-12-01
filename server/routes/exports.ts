/**
 * Export API
 * 
 * Endpoints for exporting chat conversations and code as Markdown/PDF
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { chatMessages, conversationSessions } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

interface ExportRequest {
  sessionId?: string;
  projectId?: string;
  format: 'markdown' | 'json';
  contentType: 'chat' | 'code' | 'full';
  includeTimestamps?: boolean;
  includeMetadata?: boolean;
}

/**
 * POST /api/exports/chat
 * Export chat conversation as Markdown or JSON
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { 
      sessionId, 
      projectId, 
      format = 'markdown', 
      includeTimestamps = true,
      includeMetadata = false 
    } = req.body as ExportRequest;

    // Fetch messages
    let whereClause;
    if (sessionId) {
      whereClause = and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.conversationStateId, sessionId)
      );
    } else if (projectId) {
      whereClause = and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.projectId, projectId)
      );
    } else {
      whereClause = eq(chatMessages.userId, userId);
    }

    const messages = await db.select()
      .from(chatMessages)
      .where(whereClause)
      .orderBy(chatMessages.createdAt)
      .limit(1000);

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No messages found to export',
      });
    }

    // Get session info if available
    let sessionTitle = 'Chat Export';
    if (sessionId) {
      const session = await db.select()
        .from(conversationSessions)
        .where(eq(conversationSessions.id, sessionId))
        .limit(1);
      if (session[0]) {
        sessionTitle = session[0].title;
      }
    }

    if (format === 'json') {
      // JSON export
      const exportData = {
        title: sessionTitle,
        exportedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: includeTimestamps ? m.createdAt : undefined,
          ...(includeMetadata ? { id: m.id, projectId: m.projectId } : {}),
        })),
      };

      const fileName = `chat-export-${Date.now()}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.json(exportData);
    }

    // Markdown export
    let markdown = `# ${sessionTitle}\n\n`;
    markdown += `*Exported on ${new Date().toLocaleString()}*\n\n`;
    markdown += `---\n\n`;

    let codeBlockCount = 0;
    
    for (const msg of messages) {
      const roleLabel = msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Scout' : msg.role;
      const timestamp = includeTimestamps && msg.createdAt 
        ? ` *(${new Date(msg.createdAt).toLocaleString()})*` 
        : '';
      
      markdown += `## ${roleLabel}${timestamp}\n\n`;
      markdown += `${msg.content}\n\n`;
      
      // Count code blocks
      const codeMatches = msg.content.match(/```/g);
      if (codeMatches) {
        codeBlockCount += Math.floor(codeMatches.length / 2);
      }
      
      markdown += `---\n\n`;
    }

    // Add summary
    markdown += `\n## Export Summary\n\n`;
    markdown += `- **Total Messages**: ${messages.length}\n`;
    markdown += `- **Code Blocks**: ${codeBlockCount}\n`;
    markdown += `- **Session**: ${sessionTitle}\n`;

    const fileName = `chat-export-${Date.now()}.md`;
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(markdown);

  } catch (error: any) {
    console.error('[EXPORTS-API] Error exporting chat:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export chat',
    });
  }
});

/**
 * POST /api/exports/code
 * Export code snippets from chat as a collection
 */
router.post('/code', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { sessionId, projectId, format = 'markdown' } = req.body as ExportRequest;

    // Fetch messages
    let whereClause;
    if (sessionId) {
      whereClause = and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.conversationStateId, sessionId)
      );
    } else if (projectId) {
      whereClause = and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.projectId, projectId)
      );
    } else {
      whereClause = eq(chatMessages.userId, userId);
    }

    const messages = await db.select()
      .from(chatMessages)
      .where(whereClause)
      .orderBy(chatMessages.createdAt)
      .limit(1000);

    // Extract code blocks
    const codeBlocks: Array<{
      language: string;
      code: string;
      context: string;
      messageRole: string;
    }> = [];

    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

    for (const msg of messages) {
      let match;
      while ((match = codeBlockRegex.exec(msg.content)) !== null) {
        const language = match[1] || 'text';
        const code = match[2].trim();
        
        // Get context (text before the code block)
        const contextMatch = msg.content.substring(0, match.index).split('\n').slice(-3).join('\n').trim();
        
        codeBlocks.push({
          language,
          code,
          context: contextMatch.substring(0, 200),
          messageRole: msg.role,
        });
      }
    }

    if (codeBlocks.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No code blocks found to export',
      });
    }

    if (format === 'json') {
      const fileName = `code-export-${Date.now()}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.json({
        exportedAt: new Date().toISOString(),
        codeBlockCount: codeBlocks.length,
        codeBlocks,
      });
    }

    // Markdown export
    let markdown = `# Code Snippets Export\n\n`;
    markdown += `*Exported on ${new Date().toLocaleString()}*\n\n`;
    markdown += `**Total Code Blocks**: ${codeBlocks.length}\n\n`;
    markdown += `---\n\n`;

    codeBlocks.forEach((block, index) => {
      markdown += `## Snippet ${index + 1} (${block.language})\n\n`;
      if (block.context) {
        markdown += `> ${block.context}\n\n`;
      }
      markdown += `\`\`\`${block.language}\n${block.code}\n\`\`\`\n\n`;
      markdown += `---\n\n`;
    });

    const fileName = `code-export-${Date.now()}.md`;
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(markdown);

  } catch (error: any) {
    console.error('[EXPORTS-API] Error exporting code:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export code',
    });
  }
});

export default router;
