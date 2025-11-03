import { db } from '../db';
import { lomuJobs, chatMessages, tasks, platformIncidents } from '@shared/schema';
import { desc, eq, and, gt, count } from 'drizzle-orm';

/**
 * Agent Failure Detector
 * 
 * Monitors LomuAI agent performance and detects failures:
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
      suggestedStrategy = 'architect'; // Agent failures need expert review
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
        suggestedStrategy = 'architect';
      }
    }
    
    // 3. Check recent LomuAI job failures
    const recentFailures = await this.checkRecentJobFailures();
    if (recentFailures.count > 2) {
      isAgentFailure = true;
      incidentCategory = 'agent_failure';
      confidence = Math.min(confidence + 15, 95);
      evidence.push(`${recentFailures.count} recent LomuAI job failures detected`);
      suggestedStrategy = 'architect'; // Repeated failures need expert intervention
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
        suggestedStrategy = 'lomu_ai'; // Platform issues can be fixed by LomuAI
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
   * Check recent LomuAI job failures (last hour)
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
          incidentCategory: 'agent_failure',
          isAgentFailure: true,
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
