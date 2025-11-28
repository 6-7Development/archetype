import { db } from '../db';
import { lomuJobs, chatMessages, tasks, platformIncidents } from '@shared/schema';
import { desc, eq, and, gt, count } from 'drizzle-orm';

/**
 * Agent Failure Detector
 * 
 * Monitors HexadAI agent performance and detects failures:
 * - Repeated task aborts (agent giving up)
 * - Broken code output (TypeScript errors)
 * - Infinite loops / stuck tasks
 * - Tool usage errors
 * - Low-quality responses
 * 
 * Differentiates agent failures from platform failures.
 */

export interface AgentFailureAnalysis {
  isAgentFailure: boolean;
  incidentCategory: 'platform_failure' | 'agent_failure' | 'unknown';
  confidence: number; // 0-100
  evidence: string[];
  suggestedStrategy: 'knowledge_base' | 'lomu_ai' | 'architect';
}

export class AgentFailureDetector {
  
  /**
   * Analyze an incident to determine if it's an agent failure
   */
  async analyzeIncident(incident: {
    type: string;
    severity: string;
    description: string;
    stackTrace?: string | null;
    source: string;
    logs?: string | null;
  }): Promise<AgentFailureAnalysis> {
    
    const evidence: string[] = [];
    let isAgentFailure = false;
    let incidentCategory: 'platform_failure' | 'agent_failure' | 'unknown' = 'unknown';
    let confidence = 0;
    let suggestedStrategy: 'knowledge_base' | 'lomu_ai' | 'architect' = 'lomu_ai';
    
    // 1. Check if source is 'agent_monitor' - direct agent failure marker
    if (incident.source === 'agent_monitor') {
      isAgentFailure = true;
      incidentCategory = 'agent_failure';
      confidence = 90;
      evidence.push('Incident source is agent_monitor - direct agent failure detection');
      // NOTE: I AM Architect reserved for explicit user requests
      suggestedStrategy = 'lomu_ai';
    }
    
    // 2. Check for agent-specific error patterns in description/stackTrace
    const agentErrorPatterns = [
      /lomuai.*error/i,
      /agent.*failed/i,
      /tool.*execution.*failed/i,
      /infinite.*loop.*detected/i,
      /task.*aborted/i,
      /repeated.*failures/i,
      /code.*quality.*issue/i,
      /typescript.*compilation.*error/i,
      /lsp.*diagnostic.*error/i,
    ];
    
    const fullText = `${incident.description} ${incident.stackTrace || ''} ${incident.logs || ''}`;
    
    for (const pattern of agentErrorPatterns) {
      if (pattern.test(fullText)) {
        isAgentFailure = true;
        incidentCategory = 'agent_failure';
        confidence = Math.min(confidence + 20, 95);
        evidence.push(`Matched agent error pattern: ${pattern.source}`);
        // NOTE: I AM Architect reserved for explicit user requests
        suggestedStrategy = 'lomu_ai';
      }
    }
    
    // 3. Check recent HexadAI job failures
    const recentFailures = await this.checkRecentJobFailures();
    if (recentFailures.count > 2) {
      isAgentFailure = true;
      incidentCategory = 'agent_failure';
      confidence = Math.min(confidence + 15, 95);
      evidence.push(`${recentFailures.count} recent HexadAI job failures detected`);
      // NOTE: I AM Architect reserved for explicit user requests
      suggestedStrategy = 'lomu_ai';
    }
    
    // 4. Platform failure patterns (system-level issues)
    const platformPatterns = [
      /high.*cpu/i,
      /memory.*leak/i,
      /database.*connection/i,
      /network.*timeout/i,
      /disk.*space/i,
    ];
    
    let isPlatformFailure = false;
    for (const pattern of platformPatterns) {
      if (pattern.test(fullText)) {
        isPlatformFailure = true;
        incidentCategory = 'platform_failure';
        confidence = 80;
        evidence.push(`Matched platform failure pattern: ${pattern.source}`);
        suggestedStrategy = 'lomu_ai'; // Platform issues can be fixed by HexadAI
        break;
      }
    }
    
    // 5. If still unknown, default to platform failure (conservative)
    if (incidentCategory === 'unknown') {
      incidentCategory = 'platform_failure';
      confidence = 50;
      evidence.push('No specific pattern matched - defaulting to platform failure');
      suggestedStrategy = 'knowledge_base'; // Try KB first for unknown issues
    }
    
    return {
      isAgentFailure,
      incidentCategory,
      confidence,
      evidence,
      suggestedStrategy,
    };
  }
  
  /**
   * Check recent HexadAI job failures (last hour)
   */
  private async checkRecentJobFailures(): Promise<{ count: number; details: string[] }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const failures = await db
        .select()
        .from(lomuJobs)
        .where(
          and(
            eq(lomuJobs.status, 'failed'),
            gt(lomuJobs.createdAt, oneHourAgo)
          )
        )
        .limit(10);
      
      const details = failures.map(f => `Job ${f.id}: ${f.error || 'Unknown error'}`);
      
      return {
        count: failures.length,
        details,
      };
    } catch (error) {
      console.error('[AGENT-FAILURE-DETECTOR] Error checking recent failures:', error);
      return { count: 0, details: [] };
    }
  }
  
  /**
   * Monitor for agent getting stuck (tasks running > 10 minutes)
   */
  async detectStuckTasks(): Promise<Array<{ jobId: string; duration: number }>> {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
      const stuckJobs = await db
        .select()
        .from(lomuJobs)
        .where(
          and(
            eq(lomuJobs.status, 'running'),
            gt(lomuJobs.createdAt, tenMinutesAgo)
          )
        )
        .limit(5);
      
      return stuckJobs.map(job => ({
        jobId: job.id,
        duration: job.createdAt ? Date.now() - job.createdAt.getTime() : 0,
      }));
    } catch (error) {
      console.error('[AGENT-FAILURE-DETECTOR] Error detecting stuck tasks:', error);
      return [];
    }
  }
  
  /**
   * Analyze agent response quality to detect poor/generic responses
   * Returns quality score (0-100) and detected issues
   */
  async analyzeResponseQuality(response: {
    content: string;
    userMessage: string;
    toolCallCount?: number;
  }): Promise<{
    qualityScore: number;
    isPoorQuality: boolean;
    issues: string[];
    shouldEscalate: boolean;
  }> {
    const issues: string[] = [];
    let qualityScore = 100;
    
    const content = response.content.toLowerCase();
    const userMsg = response.userMessage.toLowerCase();
    
    // Pattern 1: Generic "I don't feel" / "As an AI" responses (major red flag)
    const genericAiPatterns = [
      /i don't (feel|have feelings|experience)/i,
      /as an ai,? i (don't|cannot|can't)/i,
      /i'm (just|simply) an ai/i,
      /i don't have the ability to feel/i,
    ];
    
    for (const pattern of genericAiPatterns) {
      if (pattern.test(response.content)) {
        qualityScore -= 40;
        issues.push('Generic AI disclaimer response - lacks context awareness');
      }
    }
    
    // Pattern 2: User asks about platform capabilities but agent doesn't reference replit.md
    const capabilityQuestions = [
      /what can you do/i,
      /new (features|updates|tools|capabilities)/i,
      /recent (changes|updates|improvements)/i,
      /how (do )?.*feel/i,
    ];
    
    const hasCapabilityQuestion = capabilityQuestions.some(p => p.test(userMsg));
    const referencesContext = /(recent|update|feature|tool|capability|improvement)/i.test(content);
    
    if (hasCapabilityQuestion && !referencesContext) {
      qualityScore -= 30;
      issues.push('User asked about capabilities but agent gave generic response without context');
    }
    
    // Pattern 3: Very short response (<50 chars) when user asks complex question
    if (response.content.length < 50 && userMsg.length > 20) {
      qualityScore -= 20;
      issues.push('Response too short for user question complexity');
    }
    
    // Pattern 4: No tool usage when user asks for action
    const actionVerbs = /(fix|create|build|deploy|test|check|update|install|run|execute)/i;
    const hasActionRequest = actionVerbs.test(userMsg);
    const usedTools = (response.toolCallCount || 0) > 0;
    
    if (hasActionRequest && !usedTools && response.content.length < 200) {
      qualityScore -= 25;
      issues.push('User requested action but agent neither used tools nor provided detailed plan');
    }
    
    // Pattern 5: Repetitive/circular reasoning
    const words = response.content.split(/\s+/);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const repetitionRatio = uniqueWords.size / Math.max(words.length, 1);
    
    if (repetitionRatio < 0.3 && words.length > 20) {
      qualityScore -= 15;
      issues.push('Response contains excessive repetition');
    }
    
    const isPoorQuality = qualityScore < 60;
    const shouldEscalate = qualityScore < 40; // Critical quality issues (user can manually summon architect)
    
    return {
      qualityScore: Math.max(0, qualityScore),
      isPoorQuality,
      issues,
      shouldEscalate,
    };
  }
  
  /**
   * Create agent failure incident
   */
  async createAgentFailureIncident(details: {
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    stackTrace?: string;
    logs?: string;
  }): Promise<string> {
    try {
      const [incident] = await db
        .insert(platformIncidents)
        .values({
          type: 'agent_failure',
          severity: details.severity,
          title: details.title,
          description: details.description,
          stackTrace: details.stackTrace,
          logs: details.logs,
          source: 'agent_monitor',
          status: 'open',
        })
        .returning();
      
      console.log('[AGENT-FAILURE-DETECTOR] Created agent failure incident:', incident.id);
      
      return incident.id;
    } catch (error: any) {
      console.error('[AGENT-FAILURE-DETECTOR] Error creating incident:', error);
      throw error;
    }
  }
}

export const agentFailureDetector = new AgentFailureDetector();

/**
 * Enhanced Agent Failure Detection
 * Extends original detector with more patterns and recovery strategies
 */

export interface FailurePattern {
  name: string;
  regex: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recovery: 'retry' | 'escalate' | 'fallback' | 'manual';
}

/**
 * Comprehensive failure patterns for HexadAI
 */
export const FAILURE_PATTERNS: FailurePattern[] = [
  // Timeout patterns
  {
    name: 'Iteration timeout',
    regex: /timeout|timed out|exceeded.*time|hanging/i,
    severity: 'high',
    recovery: 'retry',
  },
  {
    name: 'Streaming timeout',
    regex: /stream.*timeout|kept alive|connection.*closed|502|gateway/i,
    severity: 'critical',
    recovery: 'manual',
  },
  // Tool execution failures
  {
    name: 'Tool execution failed',
    regex: /tool.*fail|execute.*error|tool.*not.*found|undefined.*tool/i,
    severity: 'high',
    recovery: 'retry',
  },
  {
    name: 'Tool timeout',
    regex: /tool.*timeout|bash.*timeout|execution.*timeout/i,
    severity: 'medium',
    recovery: 'fallback',
  },
  // Token and API failures
  {
    name: 'Token limit exceeded',
    regex: /token.*limit|context.*overflow|too.*many.*tokens|max.*token/i,
    severity: 'high',
    recovery: 'fallback',
  },
  {
    name: 'API rate limit',
    regex: /rate.*limit|429|quota.*exceeded|too.*many.*request/i,
    severity: 'medium',
    recovery: 'retry',
  },
  // Code quality issues
  {
    name: 'TypeScript compilation error',
    regex: /typescript.*error|type.*error|tsc.*error|compilation.*fail/i,
    severity: 'high',
    recovery: 'retry',
  },
  {
    name: 'LSP diagnostic error',
    regex: /lsp.*error|diagnostic.*error|type.*mismatch|cannot.*find/i,
    severity: 'medium',
    recovery: 'retry',
  },
  // Streaming and parsing
  {
    name: 'Invalid JSON response',
    regex: /json.*error|invalid.*json|parse.*error|unexpected.*token/i,
    severity: 'high',
    recovery: 'retry',
  },
  {
    name: 'Streaming data loss',
    regex: /stream.*incomplete|missing.*data|partial.*response|truncated/i,
    severity: 'high',
    recovery: 'retry',
  },
  // Database issues
  {
    name: 'Database connection error',
    regex: /database.*error|connection.*refused|pool.*error|query.*fail/i,
    severity: 'critical',
    recovery: 'manual',
  },
  // Memory and resource
  {
    name: 'Memory overflow',
    regex: /out.*of.*memory|heap.*size|memory.*limit|OOM/i,
    severity: 'critical',
    recovery: 'manual',
  },
  {
    name: 'Disk space error',
    regex: /disk.*full|no.*space|write.*error|insufficient.*space/i,
    severity: 'critical',
    recovery: 'manual',
  },
  // Agent-specific
  {
    name: 'Infinite loop detected',
    regex: /infinite.*loop|loop.*detected|repeated.*iteration|cycle.*detected/i,
    severity: 'high',
    recovery: 'fallback',
  },
  {
    name: 'Agent decision loop',
    regex: /same.*decision|decision.*loop|no.*progress|stuck.*on/i,
    severity: 'medium',
    recovery: 'escalate',
  },
];

/**
 * Detect failure patterns in text
 */
export function detectFailurePatterns(text: string): FailurePattern[] {
  return FAILURE_PATTERNS.filter(pattern => pattern.regex.test(text));
}

/**
 * Classify failure severity
 */
export function classifyFailureSeverity(patterns: FailurePattern[]): 'low' | 'medium' | 'high' | 'critical' {
  const severities = patterns.map(p => p.severity);

  if (severities.includes('critical')) return 'critical';
  if (severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  return 'low';
}

/**
 * Determine recovery strategy
 */
export function determineRecoveryStrategy(
  patterns: FailurePattern[]
): 'retry' | 'escalate' | 'fallback' | 'manual' {
  // Priority: manual > escalate > retry > fallback
  if (patterns.some(p => p.recovery === 'manual')) return 'manual';
  if (patterns.some(p => p.recovery === 'escalate')) return 'escalate';
  if (patterns.some(p => p.recovery === 'retry')) return 'retry';
  return 'fallback';
}

/**
 * Generate recovery action
 */
export function generateRecoveryAction(
  strategy: 'retry' | 'escalate' | 'fallback' | 'manual',
  patterns: FailurePattern[]
): string {
  const patternNames = patterns.map(p => p.name).join(', ');

  switch (strategy) {
    case 'retry':
      return `🔄 Retrying operation. Detected issues: ${patternNames}`;
    case 'escalate':
      return `📈 Escalating to architect for guidance. Issues: ${patternNames}`;
    case 'fallback':
      return `🔀 Switching to fallback strategy. Issues: ${patternNames}`;
    case 'manual':
      return `⚠️ MANUAL INTERVENTION REQUIRED. Critical issues: ${patternNames}`;
    default:
      return `⚠️ Unknown recovery needed. Issues: ${patternNames}`;
  }
}
