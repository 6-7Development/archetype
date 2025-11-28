/**
 * Phase C: Conversational Awareness Layer
 * 
 * Context injection utilities for Hexad chat to provide:
 * - Task board snapshot
 * - Recent platform changes (git history)
 * - Diagnosis report summaries
 */

import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import { tasks, chatMessages } from '@shared/schema';
import type { GitHubService } from '../githubService';

export interface TaskSnapshot {
  id: string;
  title: string;
  status: string;
  priority?: string;
  assignedAgent?: string;
  createdAt: Date;
}

export interface GitCommitSummary {
  sha: string;
  shortSHA: string;
  message: string;
  author: string;
  timestamp: Date;
}

export interface DiagnosisSummary {
  timestamp: Date;
  issuesFound: number;
  criticalIssues: number;
  warningIssues: number;
  topIssues: string[];
}

export interface MetaSysopContext {
  currentTasks: TaskSnapshot[];
  recentCommits: GitCommitSummary[];
  lastDiagnosis?: DiagnosisSummary;
  conversationHistory: Array<{ role: string; content: string; timestamp: Date }>;
}

/**
 * Get current task board snapshot
 */
export async function getTaskBoardSnapshot(limit: number = 10): Promise<TaskSnapshot[]> {
  try {
    const currentTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .where(eq(tasks.status, 'in_progress'))
      .orderBy(desc(tasks.createdAt))
      .limit(limit);

    return currentTasks.map(task => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: undefined, // Not in schema
      assignedAgent: undefined, // Not in schema
      createdAt: task.createdAt,
    }));
  } catch (error: any) {
    console.error('[CONTEXT] Failed to fetch task snapshot:', error);
    return [];
  }
}

/**
 * Get recent platform changes from git history
 */
export async function getRecentPlatformChanges(
  githubService: GitHubService,
  hoursBack: number = 24,
  limit: number = 10
): Promise<GitCommitSummary[]> {
  try {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    // GitHub Service doesn't have a listCommits with since parameter yet
    // For now, get latest commit as a placeholder
    const latestSHA = await githubService.getLatestCommit();
    
    // Return minimal commit info
    return [{
      sha: latestSHA,
      shortSHA: latestSHA.slice(0, 7),
      message: 'Latest commit',
      author: 'Unknown',
      timestamp: new Date(),
    }];
  } catch (error: any) {
    console.warn('[CONTEXT] Failed to fetch git history:', error);
    return [];
  }
}

/**
 * Get last diagnosis summary from chat history
 * Looks for recent diagnosis results in Hexad messages
 */
export async function getLastDiagnosisSummary(
  userId: string,
  sessionId?: string
): Promise<DiagnosisSummary | undefined> {
  try {
    // Query recent Hexad messages
    const recentMessages = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.isPlatformHealing, true)
        )
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(20);

    // Look for diagnosis-related messages
    for (const message of recentMessages) {
      const content = message.content.toLowerCase();
      
      // Check if this message contains diagnosis results
      if (content.includes('diagnosis') || content.includes('finding') || content.includes('issue')) {
        // Parse findings from message content
        // This is a simplified version - in production you'd store structured diagnosis results
        const criticalMatches = content.match(/critical/gi) || [];
        const warningMatches = content.match(/warning/gi) || [];
        
        return {
          timestamp: message.createdAt,
          issuesFound: criticalMatches.length + warningMatches.length,
          criticalIssues: criticalMatches.length,
          warningIssues: warningMatches.length,
          topIssues: [], // Would extract from structured data
        };
      }
    }

    return undefined;
  } catch (error: any) {
    console.error('[CONTEXT] Failed to fetch diagnosis summary:', error);
    return undefined;
  }
}

/**
 * Get conversation history for Hexad session
 */
export async function getConversationHistory(
  userId: string,
  sessionId: string,
  limit: number = 20
): Promise<Array<{ role: string; content: string; timestamp: Date }>> {
  try {
    const messages = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.isPlatformHealing, true)
        )
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    return messages
      .reverse() // Chronological order
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt,
      }));
  } catch (error: any) {
    console.error('[CONTEXT] Failed to fetch conversation history:', error);
    return [];
  }
}

/**
 * Build complete Hexad context
 */
export async function buildMetaSysopContext(
  userId: string,
  sessionId: string,
  githubService?: GitHubService
): Promise<MetaSysopContext> {
  const [currentTasks, conversationHistory] = await Promise.all([
    getTaskBoardSnapshot(10),
    getConversationHistory(userId, sessionId, 20),
  ]);

  const recentCommits = githubService
    ? await getRecentPlatformChanges(githubService, 24, 10)
    : [];

  const lastDiagnosis = await getLastDiagnosisSummary(userId, sessionId);

  return {
    currentTasks,
    recentCommits,
    lastDiagnosis,
    conversationHistory,
  };
}

/**
 * Format context as markdown for injection into system prompt
 */
export function formatContextForPrompt(context: MetaSysopContext): string {
  const sections: string[] = [];

  // Current Tasks
  if (context.currentTasks.length > 0) {
    sections.push('## Current Platform Tasks\n');
    context.currentTasks.forEach(task => {
      sections.push(`- [${task.status}] ${task.title} (${task.assignedAgent || 'unassigned'})`);
    });
    sections.push('');
  }

  // Recent Commits
  if (context.recentCommits.length > 0) {
    sections.push('## Recent Platform Changes\n');
    context.recentCommits.forEach(commit => {
      sections.push(`- ${commit.shortSHA}: ${commit.message} (${commit.author}, ${commit.timestamp.toLocaleString()})`);
    });
    sections.push('');
  }

  // Last Diagnosis
  if (context.lastDiagnosis) {
    sections.push('## Last Platform Diagnosis\n');
    sections.push(`- Timestamp: ${context.lastDiagnosis.timestamp.toLocaleString()}`);
    sections.push(`- Issues Found: ${context.lastDiagnosis.issuesFound}`);
    sections.push(`- Critical: ${context.lastDiagnosis.criticalIssues}, Warnings: ${context.lastDiagnosis.warningIssues}`);
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Sanitize content to prevent secret leakage
 */
export function sanitizeContent(content: string): string {
  return content
    // API Keys
    .replace(/ANTHROPIC_API_KEY=.+/g, 'ANTHROPIC_API_KEY=***')
    .replace(/OPENAI_API_KEY=.+/g, 'OPENAI_API_KEY=***')
    .replace(/sk-ant-[a-zA-Z0-9-]+/g, 'sk-ant-***')
    .replace(/sk-[a-zA-Z0-9]{48}/g, 'sk-***')
    
    // GitHub Tokens
    .replace(/GITHUB_TOKEN=.+/g, 'GITHUB_TOKEN=***')
    .replace(/ghp_[a-zA-Z0-9]+/g, 'ghp_***')
    .replace(/gho_[a-zA-Z0-9]+/g, 'gho_***')
    
    // Database URLs
    .replace(/DATABASE_URL=.+/g, 'DATABASE_URL=***')
    .replace(/postgres:\/\/[^\s]+/g, 'postgres://***')
    .replace(/postgresql:\/\/[^\s]+/g, 'postgresql://***')
    
    // Session Secrets
    .replace(/SESSION_SECRET=.+/g, 'SESSION_SECRET=***')
    
    // Stripe Keys
    .replace(/STRIPE_SECRET_KEY=.+/g, 'STRIPE_SECRET_KEY=***')
    .replace(/sk_live_[a-zA-Z0-9]+/g, 'sk_live_***')
    .replace(/sk_test_[a-zA-Z0-9]+/g, 'sk_test_***')
    
    // Generic secrets pattern
    .replace(/[a-zA-Z0-9_]*SECRET[a-zA-Z0-9_]*=.+/gi, (match) => {
      const key = match.split('=')[0];
      return `${key}=***`;
    });
}

/**
 * Extract inline diff from file change
 */
export function formatInlineDiff(
  filePath: string,
  contentBefore: string,
  contentAfter: string,
  contextLines: number = 3
): string {
  const beforeLines = contentBefore.split('\n');
  const afterLines = contentAfter.split('\n');
  
  // Simple line-by-line diff (in production, use a proper diff library)
  const diff: string[] = [`Modified: ${filePath}\n`];
  
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  let changes = 0;
  
  for (let i = 0; i < maxLines; i++) {
    const before = beforeLines[i] || '';
    const after = afterLines[i] || '';
    
    if (before !== after) {
      changes++;
      if (before) {
        diff.push(`- ${before}`);
      }
      if (after) {
        diff.push(`+ ${after}`);
      }
    }
  }
  
  if (changes === 0) {
    return `Modified: ${filePath} (no line changes)`;
  }
  
  return diff.join('\n');
}
