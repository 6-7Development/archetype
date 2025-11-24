/**
 * AI DECISION LOGGER - Complete Audit Trail for AI Agent Actions
 * Tracks decisions, tools used, costs, failures, and rollbacks
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ==================== INTERFACES ====================

export interface AIDecisionRecord {
  id: string;
  timestamp: number;
  userId: string;
  sessionId: string;
  agent: 'gemini-flash' | 'claude-sonnet-4' | 'sub-agent' | 'i-am-architect';
  action: 'task-start' | 'tool-call' | 'code-generation' | 'rollback' | 'healing' | 'completion' | 'error';
  description: string;
  tools?: string[];
  filesModified?: string[];
  costEstimate?: number;
  costActual?: number;
  duration?: number;
  success: boolean;
  reason?: string; // Why this decision was made
  metadata?: Record<string, any>;
}

export interface AIDecisionStats {
  totalDecisions: number;
  successRate: number;
  avgCostPerDecision: number;
  avgDurationMs: number;
  failureReasons: Record<string, number>;
  topToolsUsed: Array<{ tool: string; count: number }>;
}

// ==================== AI DECISION LOGGER ====================

export class AIDecisionLogger {
  private logDir: string;
  private sessionLogs: Map<string, AIDecisionRecord[]> = new Map();
  private stats: Map<string, AIDecisionStats> = new Map();

  constructor(logDir: string = './logs/ai-decisions') {
    this.logDir = logDir;
  }

  /**
   * Initialize logger and create log directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('[AI-DECISION-LOGGER] Failed to create log directory:', error);
    }
  }

  /**
   * Log an AI decision
   */
  async logDecision(record: Omit<AIDecisionRecord, 'id' | 'timestamp'>): Promise<string> {
    const id = `${record.sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const decision: AIDecisionRecord = {
      ...record,
      id,
      timestamp: Date.now(),
    };

    // Store in memory
    const sessionLogs = this.sessionLogs.get(record.sessionId) || [];
    sessionLogs.push(decision);
    this.sessionLogs.set(record.sessionId, sessionLogs);

    // Write to file (async, non-blocking)
    this.writeToFile(record.sessionId, decision).catch((err) => {
      console.error('[AI-DECISION-LOGGER] Failed to write log:', err);
    });

    // Update stats
    this.updateStats(record.userId, decision);

    // Log to console in verbose mode
    if (process.env.VERBOSE_LOGGING === 'true') {
      console.log(`[AI-DECISION] ${decision.agent}: ${decision.action} - ${decision.description}`);
    }

    return id;
  }

  /**
   * Get decisions for a session
   */
  getSessionDecisions(sessionId: string): AIDecisionRecord[] {
    return this.sessionLogs.get(sessionId) || [];
  }

  /**
   * Get decisions for a user
   */
  async getUserDecisions(userId: string, limit: number = 100): Promise<AIDecisionRecord[]> {
    const decisions: AIDecisionRecord[] = [];

    try {
      const files = await fs.readdir(this.logDir);
      const userFiles = files.filter((f) => f.startsWith(userId));

      for (const file of userFiles.slice(-10)) {
        // Read last 10 files
        const content = await fs.readFile(path.join(this.logDir, file), 'utf-8');
        const records = content.split('\n').filter((l) => l.trim());
        for (const line of records) {
          try {
            decisions.push(JSON.parse(line));
            if (decisions.length >= limit) break;
          } catch (e) {
            // Skip malformed lines
          }
        }
        if (decisions.length >= limit) break;
      }
    } catch (error) {
      console.error('[AI-DECISION-LOGGER] Failed to read user decisions:', error);
    }

    return decisions.slice(0, limit);
  }

  /**
   * Get statistics for a user
   */
  getStats(userId: string): AIDecisionStats | undefined {
    return this.stats.get(userId);
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(userId: string, sessionId: string): Promise<string> {
    const decisions = this.getSessionDecisions(sessionId);

    let report = `# AI Decision Audit Report\n\n`;
    report += `**User:** ${userId}\n`;
    report += `**Session:** ${sessionId}\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Summary
    report += `## Summary\n`;
    report += `- **Total Decisions:** ${decisions.length}\n`;
    report += `- **Successful:** ${decisions.filter((d) => d.success).length}\n`;
    report += `- **Failed:** ${decisions.filter((d) => !d.success).length}\n`;

    const totalCost = decisions.reduce((sum, d) => sum + (d.costActual || 0), 0);
    report += `- **Total Cost:** $${(totalCost / 100).toFixed(2)}\n`;

    const totalDuration = decisions.reduce((sum, d) => sum + (d.duration || 0), 0);
    report += `- **Total Duration:** ${totalDuration}ms\n\n`;

    // Timeline
    report += `## Decision Timeline\n`;
    for (const decision of decisions) {
      const time = new Date(decision.timestamp).toISOString();
      const status = decision.success ? '✅' : '❌';
      report += `${status} **${time}** - ${decision.agent}: ${decision.action}\n`;
      report += `   - ${decision.description}\n`;

      if (decision.tools?.length) {
        report += `   - Tools: ${decision.tools.join(', ')}\n`;
      }

      if (decision.reason) {
        report += `   - Reason: ${decision.reason}\n`;
      }

      if (decision.costActual) {
        report += `   - Cost: $${(decision.costActual / 100).toFixed(4)}\n`;
      }

      if (!decision.success && decision.metadata?.error) {
        report += `   - Error: ${decision.metadata.error}\n`;
      }

      report += '\n';
    }

    // Failures analysis
    const failures = decisions.filter((d) => !d.success);
    if (failures.length > 0) {
      report += `## Failures Analysis\n`;
      const failureReasons: Record<string, number> = {};

      for (const failure of failures) {
        const reason = failure.reason || 'Unknown';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      }

      for (const [reason, count] of Object.entries(failureReasons)) {
        report += `- ${reason}: ${count}\n`;
      }

      report += '\n';
    }

    // Tools used
    const toolsUsed: Record<string, number> = {};
    for (const decision of decisions) {
      if (decision.tools) {
        for (const tool of decision.tools) {
          toolsUsed[tool] = (toolsUsed[tool] || 0) + 1;
        }
      }
    }

    if (Object.keys(toolsUsed).length > 0) {
      report += `## Tools Used\n`;
      const sorted = Object.entries(toolsUsed).sort((a, b) => b[1] - a[1]);
      for (const [tool, count] of sorted) {
        report += `- ${tool}: ${count} times\n`;
      }
      report += '\n';
    }

    return report;
  }

  /**
   * Private: Write decision to file
   */
  private async writeToFile(sessionId: string, decision: AIDecisionRecord): Promise<void> {
    const fileName = path.join(this.logDir, `${sessionId}.jsonl`);

    try {
      await fs.appendFile(fileName, JSON.stringify(decision) + '\n');
    } catch (error) {
      console.error('[AI-DECISION-LOGGER] Write failed:', error);
    }
  }

  /**
   * Private: Update statistics
   */
  private updateStats(userId: string, decision: AIDecisionRecord): void {
    const current = this.stats.get(userId) || {
      totalDecisions: 0,
      successRate: 0,
      avgCostPerDecision: 0,
      avgDurationMs: 0,
      failureReasons: {},
      topToolsUsed: [],
    };

    current.totalDecisions++;

    // Update success rate
    const successCount = this.getSessionDecisions(decision.sessionId).filter((d) => d.success).length;
    current.successRate = successCount / current.totalDecisions;

    // Update average cost
    const totalCost = this.getSessionDecisions(decision.sessionId).reduce((sum, d) => sum + (d.costActual || 0), 0);
    current.avgCostPerDecision = totalCost / current.totalDecisions;

    // Update average duration
    const totalDuration = this.getSessionDecisions(decision.sessionId).reduce((sum, d) => sum + (d.duration || 0), 0);
    current.avgDurationMs = totalDuration / current.totalDecisions;

    // Track failure reasons
    if (!decision.success && decision.reason) {
      current.failureReasons[decision.reason] = (current.failureReasons[decision.reason] || 0) + 1;
    }

    // Track top tools
    if (decision.tools?.length) {
      for (const tool of decision.tools) {
        const existing = current.topToolsUsed.find((t) => t.tool === tool);
        if (existing) {
          existing.count++;
        } else {
          current.topToolsUsed.push({ tool, count: 1 });
        }
      }
      current.topToolsUsed.sort((a, b) => b.count - a.count).slice(0, 10);
    }

    this.stats.set(userId, current);
  }
}

// Export singleton
export const aiDecisionLogger = new AIDecisionLogger();
