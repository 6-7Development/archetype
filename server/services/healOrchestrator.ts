import { EventEmitter } from 'events';
import { db } from '../db';
import { platformHealingSessions, platformHealAttempts, platformIncidents, aiKnowledgeBase } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { aiHealingService } from './aiHealingService';
import { platformHealing } from '../platformHealing';
import type { PlatformMetricsBroadcaster } from './platformMetricsBroadcaster';
import { ConfidenceScoring } from './confidenceScoring';
import { getGitHubService } from '../githubService';

/**
 * HealOrchestrator
 * 
 * Consumes incidents from healthMonitor and triggers automated healing.
 * Tracks healing sessions and coordinates the fix loop.
 * 
 * Safety Guards:
 * - Kill-switch: Disable auto-healing after 3 consecutive failures
 * - Rate limiting: Max 3 healing sessions per hour
 * - Audit trail: All attempts logged to platformHealAttempts
 * - Rollback: Automatic rollback on verification or deployment failure
 */
export class HealOrchestrator extends EventEmitter {
  private isHealing: boolean = false;
  private currentSessionId: string | null = null;
  private broadcaster: PlatformMetricsBroadcaster | null = null;
  
  // Safety Guards
  private killSwitchActive: boolean = false;
  private killSwitchUntil: Date | null = null;
  private consecutiveFailures: number = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly KILL_SWITCH_DURATION_MS = 60 * 60 * 1000; // 1 hour
  
  // Rate Limiting
  private healingSessionTimestamps: Date[] = [];
  private readonly MAX_SESSIONS_PER_HOUR = 3;
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  
  constructor() {
    super();
    
    // Periodic cleanup of old session timestamps
    setInterval(() => this.cleanupOldTimestamps(), 5 * 60 * 1000); // Every 5 minutes
  }
  
  /**
   * Set the metrics broadcaster for healing event notifications
   */
  setBroadcaster(broadcaster: PlatformMetricsBroadcaster): void {
    this.broadcaster = broadcaster;
    console.log('[HEAL-ORCHESTRATOR] Metrics broadcaster connected');
  }
  
  /**
   * Start the orchestrator (listen for incidents)
   */
  async start(healthMonitor: any) {
    console.log('[HEAL-ORCHESTRATOR] Starting autonomous healing orchestrator...');
    
    // Listen for incidents from health monitor
    healthMonitor.on('incident-detected', async (data: any) => {
      await this.handleIncidentDetected(data);
    });
    
    healthMonitor.on('incident-resolved', async (data: any) => {
      console.log(`[HEAL-ORCHESTRATOR] Incident ${data.incidentId} resolved naturally`);
    });
    
    console.log('[HEAL-ORCHESTRATOR] Orchestrator started');
  }
  
  /**
   * Verify that the fix didn't break anything using REAL TypeScript compilation
   */
  private async verifyFix(filesModified: string[]): Promise<{ passed: boolean; results: any }> {
    console.log('[HEAL-ORCHESTRATOR] Running REAL verification checks (tsc --noEmit)...');
    
    const results = {
      filesExist: false,
      typescriptValid: false,
      errorDetails: '',
    };
    
    try {
      // Check 1: Modified files still exist
      const fs = await import('fs/promises');
      const path = await import('path');
      
      let allFilesExist = true;
      for (const file of filesModified) {
        const filePath = path.join(process.cwd(), file);
        try {
          await fs.access(filePath);
        } catch {
          console.error('[HEAL-ORCHESTRATOR] File missing after fix:', file);
          allFilesExist = false;
        }
      }
      results.filesExist = allFilesExist;
      
      // Check 2: Run REAL TypeScript compilation check
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        // Run tsc --noEmit to check for TypeScript errors WITHOUT emitting files
        await execAsync('npx tsc --noEmit', {
          cwd: process.cwd(),
          timeout: 30000, // 30 second timeout
        });
        
        results.typescriptValid = true;
        console.log('[HEAL-ORCHESTRATOR] ✅ TypeScript compilation check PASSED');
      } catch (tscError: any) {
        results.typescriptValid = false;
        results.errorDetails = tscError.stdout || tscError.stderr || tscError.message;
        console.error('[HEAL-ORCHESTRATOR] ❌ TypeScript compilation check FAILED:', results.errorDetails);
      }
      
      const passed = results.filesExist && results.typescriptValid;
      
      console.log('[HEAL-ORCHESTRATOR] Verification result:', passed ? '✅ PASS' : '❌ FAIL', results);
      
      return { passed, results };
    } catch (error) {
      console.error('[HEAL-ORCHESTRATOR] Verification error:', error);
      return {
        passed: false,
        results: { ...results, errorDetails: String(error) }
      };
    }
  }
  
  /**
   * Handle new incident detection
   */
  private async handleIncidentDetected(data: { incidentId: string; incident: any }) {
    const { incidentId, incident } = data;
    
    console.log(`[HEAL-ORCHESTRATOR] 🚨 Handling incident: ${incident.type} (${incidentId})`);
    
    // SAFETY GUARD: Check kill-switch status
    if (this.killSwitchActive && this.killSwitchUntil) {
      if (new Date() < this.killSwitchUntil) {
        const minutesRemaining = Math.ceil((this.killSwitchUntil.getTime() - Date.now()) / 60000);
        console.log(`[HEAL-ORCHESTRATOR] ⛔ Kill-switch active (${minutesRemaining} min remaining)`);
        console.log('[HEAL-ORCHESTRATOR] Auto-healing disabled due to consecutive failures');
        return;
      } else {
        // Kill-switch expired, reset
        console.log('[HEAL-ORCHESTRATOR] ✅ Kill-switch expired, re-enabling auto-healing');
        this.killSwitchActive = false;
        this.killSwitchUntil = null;
        this.consecutiveFailures = 0;
      }
    }
    
    // SAFETY GUARD: Check rate limiting
    this.cleanupOldTimestamps();
    if (this.healingSessionTimestamps.length >= this.MAX_SESSIONS_PER_HOUR) {
      console.log(`[HEAL-ORCHESTRATOR] ⏱️ Rate limit reached: ${this.healingSessionTimestamps.length}/${this.MAX_SESSIONS_PER_HOUR} sessions in last hour`);
      const oldestSession = this.healingSessionTimestamps[0];
      const minutesUntilReset = Math.ceil((oldestSession.getTime() + this.RATE_LIMIT_WINDOW_MS - Date.now()) / 60000);
      console.log(`[HEAL-ORCHESTRATOR] Wait ${minutesUntilReset} minutes before next healing session`);
      return;
    }
    
    // Check if we're already healing something
    if (this.isHealing) {
      console.log('[HEAL-ORCHESTRATOR] Already healing another incident, queuing...');
      return;
    }
    
    // Check attempt count (max 3 attempts)
    if (incident.attemptCount >= 3) {
      console.log('[HEAL-ORCHESTRATOR] Max attempts reached, giving up on incident', incidentId);
      await db
        .update(platformIncidents)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(platformIncidents.id, incidentId));
      return;
    }
    
    // Record session timestamp for rate limiting
    this.healingSessionTimestamps.push(new Date());
    
    // Start healing
    this.isHealing = true;
    await this.startHealingSession(incidentId, incident);
  }
  
  /**
   * Clean up old session timestamps (older than 1 hour)
   */
  private cleanupOldTimestamps(): void {
    const cutoff = Date.now() - this.RATE_LIMIT_WINDOW_MS;
    this.healingSessionTimestamps = this.healingSessionTimestamps.filter(
      timestamp => timestamp.getTime() > cutoff
    );
  }
  
  /**
   * Activate kill-switch after consecutive failures
   */
  private activateKillSwitch(): void {
    this.killSwitchActive = true;
    this.killSwitchUntil = new Date(Date.now() + this.KILL_SWITCH_DURATION_MS);
    console.log(`[HEAL-ORCHESTRATOR] ⛔ KILL-SWITCH ACTIVATED`);
    console.log(`[HEAL-ORCHESTRATOR] Auto-healing disabled until ${this.killSwitchUntil.toISOString()}`);
    console.log(`[HEAL-ORCHESTRATOR] Reason: ${this.consecutiveFailures} consecutive failures`);
    
    // Broadcast kill-switch activation
    if (this.broadcaster) {
      this.broadcaster.broadcastHealingEvent({
        type: 'kill-switch-activated',
        consecutiveFailures: this.consecutiveFailures,
        disabledUntil: this.killSwitchUntil.toISOString(),
        message: `⛔ Auto-healing disabled for 1 hour due to ${this.consecutiveFailures} consecutive failures`,
      });
    }
  }
  
  /**
   * Start a healing session for an incident
   */
  private async startHealingSession(incidentId: string, incident: any) {
    try {
      console.log(`[HEAL-ORCHESTRATOR] Starting healing session for incident ${incidentId}`);
      
      // Update incident status
      await db
        .update(platformIncidents)
        .set({
          status: 'healing',
          attemptCount: incident.attemptCount + 1,
          lastAttemptAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(platformIncidents.id, incidentId));
      
      // Create healing session
      const [session] = await db
        .insert(platformHealingSessions)
        .values({
          incidentId,
          phase: 'diagnosis',
          status: 'active',
        })
        .returning();
      
      this.currentSessionId = session.id;
      
      console.log(`[HEAL-ORCHESTRATOR] Created healing session ${session.id}`);
      
      // Generate diagnostic prompt based on incident type
      const diagnosticPrompt = this.generateDiagnosticPrompt(incident);
      
      console.log('[HEAL-ORCHESTRATOR] 🤖 Starting autonomous healing...');
      console.log('[HEAL-ORCHESTRATOR] Diagnostic prompt:', diagnosticPrompt);
      
      // Create heal attempt record
      await db.insert(platformHealAttempts).values({
        incidentId,
        sessionId: session.id,
        attemptNumber: incident.attemptCount + 1,
        strategy: 'standard',
        actionsTaken: [{ action: 'diagnosis_started', timestamp: new Date() }],
        success: false, // Will update when complete
        verificationPassed: false,
      });
      
      // Emit event for monitoring
      this.emit('healing-started', {
        incidentId,
        sessionId: session.id,
        incident,
      });
      
      // 🧠 Check knowledge base for similar errors BEFORE calling AI
      console.log('[HEAL-ORCHESTRATOR] 🧠 Checking knowledge base for similar errors...');
      const errorSignature = ConfidenceScoring.generateErrorSignature({
        type: incident.type,
        message: incident.description,
        stackTrace: incident.stackTrace,
      });
      
      // Call AI healing service
      const healingResult = await aiHealingService.diagnoseAndFix(
        diagnosticPrompt,
        incident
      );

      if (healingResult.success) {
        // Run verification BEFORE committing
        const verification = await this.verifyFix(healingResult.filesModified || []);

        if (verification.passed) {
          // 📊 Calculate confidence score to determine auto-commit vs PR
          console.log('[HEAL-ORCHESTRATOR] 📊 Calculating confidence score...');
          const confidenceResult = await ConfidenceScoring.calculateConfidence({
            errorType: incident.type,
            errorMessage: incident.description,
            stackTrace: incident.stackTrace,
            filesModified: healingResult.filesModified || [],
            proposedFix: healingResult.fixApplied || '',
            verificationPassed: verification.passed,
          });
          
          console.log(`[HEAL-ORCHESTRATOR] Confidence: ${confidenceResult.score}% - ${confidenceResult.recommendation}`);
          console.log('[HEAL-ORCHESTRATOR] Reasoning:');
          confidenceResult.reasoning.forEach(r => console.log(`  ${r}`));
          
          // Record fix attempt
          await ConfidenceScoring.recordFixAttempt({
            errorSignature,
            healingSessionId: session.id,
            proposedFix: healingResult.fixApplied || '',
            confidenceScore: confidenceResult.score,
            outcome: 'pending',
            verificationResults: verification.results,
          });
          
          // Decide: Auto-commit or Create PR
          if (confidenceResult.recommendation === 'auto_commit') {
            // HIGH CONFIDENCE: Auto-commit to main
            console.log('[HEAL-ORCHESTRATOR] ✅ HIGH CONFIDENCE - Auto-committing to main...');
            
            try {
            
            // Manual commit since we skipped auto-commit
            const commitResult = await platformHealing.manualCommit(
              `[AUTO-HEAL] Fix ${incident.type}: ${incident.title}`,
              healingResult.filesModified || []
            );
            
            // commitResult.success is true even if "nothing to commit"
            console.log('[HEAL-ORCHESTRATOR] ✅ Commit result:', commitResult.message);
            if (commitResult.commitHash) {
              console.log('[HEAL-ORCHESTRATOR] Commit hash:', commitResult.commitHash);
            }
            
            // DEPLOYMENT TRACKING: Trigger deployment if in production or ENABLE_DEPLOY_ON_HEAL is set
            const shouldDeploy = process.env.NODE_ENV === 'production' || process.env.ENABLE_DEPLOY_ON_HEAL === 'true';
            
            if (shouldDeploy) {
              console.log('[HEAL-ORCHESTRATOR] 🚀 Initiating deployment...');
              
              // Update session to deploy phase
              await db
                .update(platformHealingSessions)
                .set({
                  phase: 'deploy',
                  commitHash: commitResult.commitHash || undefined,
                  deploymentStatus: 'deploying',
                  deploymentStartedAt: new Date(),
                })
                .where(eq(platformHealingSessions.id, session.id));
              
              // Broadcast deployment start
              if (this.broadcaster) {
                this.broadcaster.broadcastDeploymentStatus({
                  sessionId: session.id,
                  incidentId,
                  deploymentStatus: 'deploying',
                  timestamp: new Date().toISOString(),
                });
              }
              
              // NOTE: Actual deployment happens via Railway/Render auto-deploy on git push
              // They will send a webhook to /api/webhooks/deployment with the status
              console.log('[HEAL-ORCHESTRATOR] Waiting for deployment webhook...');
              console.log('[HEAL-ORCHESTRATOR] Session will be updated when deployment completes');
            } else {
              // No deployment needed (development mode) - mark as complete
              await db
                .update(platformHealingSessions)
                .set({
                  phase: 'complete',
                  status: 'success',
                  diagnosisNotes: healingResult.diagnosis,
                  proposedFix: healingResult.fixApplied,
                  filesChanged: healingResult.filesModified,
                  verificationResults: verification.results,
                  verificationPassed: true,
                  commitHash: commitResult.commitHash || undefined,
                  completedAt: new Date(),
                })
                .where(eq(platformHealingSessions.id, session.id));
              
              // Update incident as resolved
              await db
                .update(platformIncidents)
                .set({
                  status: 'resolved',
                  resolvedAt: new Date(),
                  rootCause: healingResult.diagnosis,
                  fixDescription: healingResult.fixApplied,
                  commitHash: commitResult.commitHash || undefined,
                })
                .where(eq(platformIncidents.id, incidentId));
              
              // Reset consecutive failures on success
              this.consecutiveFailures = 0;
              
              // Update knowledge base with successful fix
              await ConfidenceScoring.updateKnowledgeBase({
                errorSignature,
                errorType: incident.type,
                context: {
                  filePaths: healingResult.filesModified,
                  stackTrace: incident.stackTrace,
                  errorMessage: incident.description,
                },
                successfulFix: healingResult.fixApplied,
                wasSuccessful: true,
                confidence: confidenceResult.score,
              });
              
              // Broadcast success
              if (this.broadcaster) {
                this.broadcaster.broadcastHealingEvent({
                  type: 'healing-complete',
                  incidentId,
                  sessionId: session.id,
                  incident: { type: incident.type, title: incident.title },
                  result: 'success',
                  message: `✅ Auto-fixed ${incident.type}: ${incident.title} (${confidenceResult.score}% confidence)`,
                });
              }
              
              this.emit('healing-complete', {
                incidentId,
                sessionId: session.id,
                result: healingResult,
              });
            }
            
          } catch (commitError) {
            // Only rollback on REAL commit errors
            console.error('[HEAL-ORCHESTRATOR] Commit failed with error:', commitError);
            verification.passed = false; // Treat as verification failure
            
            // Increment consecutive failures
            this.consecutiveFailures++;
          }
          } else {
            // LOW CONFIDENCE: Create GitHub PR for human review
            console.log('[HEAL-ORCHESTRATOR] ⚠️ LOW CONFIDENCE - Creating GitHub PR for review...');
            
            try {
              const github = getGitHubService();
              const branchName = `lomu-ai/auto-heal-${incidentId.substring(0, 8)}`;
              
              // Create branch
              await github.createBranchFromMain(branchName);
              
              // Push changes to branch
              const fs = await import('fs/promises');
              const path = await import('path');
              
              const fileChanges = await Promise.all(
                (healingResult.filesModified || []).map(async (filePath) => {
                  try {
                    const fullPath = path.join(process.cwd(), filePath);
                    const content = await fs.readFile(fullPath, 'utf-8');
                    return {
                      path: filePath,
                      content,
                      operation: 'modify' as const,
                    };
                  } catch (error) {
                    console.error(`[HEAL-ORCHESTRATOR] Failed to read file ${filePath}:`, error);
                    // Skip files that can't be read
                    return null;
                  }
                })
              ).then(results => results.filter((r): r is NonNullable<typeof r> => r !== null));
              
              if (fileChanges.length === 0) {
                throw new Error('No valid file changes to push');
              }
              
              await github.pushChangesToBranch(
                branchName,
                fileChanges,
                `Auto-heal: ${incident.title}`
              );
              
              // Create PR
              const prResult = await github.createOrUpdatePR(
                branchName,
                `🤖 Auto-Heal: ${incident.title}`,
                `## Proposed Fix\n\n${healingResult.fixApplied}\n\n## Confidence Analysis\n\n**Score: ${confidenceResult.score}%**\n\n${confidenceResult.reasoning.join('\n')}\n\n## Verification Results\n\n✅ TypeScript: ${verification.results.typescriptValid ? 'PASS' : 'FAIL'}\n\n---\n\n*This PR was created automatically by LomuAI's self-healing system. Please review before merging.*`
              );
              
              console.log(`[HEAL-ORCHESTRATOR] ✅ Created PR #${prResult.prNumber}: ${prResult.prUrl}`);
              
              // Update session with PR info
              await db
                .update(platformHealingSessions)
                .set({
                  phase: 'complete',
                  status: 'success',
                  verificationResults: verification.results,
                  verificationPassed: true,
                  completedAt: new Date(),
                })
                .where(eq(platformHealingSessions.id, session.id));
              
              // Update incident as resolved (pending PR merge)
              await db
                .update(platformIncidents)
                .set({
                  status: 'resolved',
                  resolvedAt: new Date(),
                  rootCause: healingResult.diagnosis,
                  fixDescription: `PR created: ${prResult.prUrl}`,
                })
                .where(eq(platformIncidents.id, incidentId));
              
              // Record PR creation in fix attempts
              await ConfidenceScoring.recordFixAttempt({
                errorSignature,
                healingSessionId: session.id,
                proposedFix: healingResult.fixApplied || '',
                confidenceScore: confidenceResult.score,
                outcome: 'success',
                verificationResults: verification.results,
                prNumber: prResult.prNumber,
                prUrl: prResult.prUrl,
              });
              
              // Broadcast PR creation
              if (this.broadcaster) {
                this.broadcaster.broadcastHealingEvent({
                  type: 'healing-complete',
                  incidentId,
                  sessionId: session.id,
                  incident: { type: incident.type, title: incident.title },
                  result: 'pr_created',
                  message: `📋 Created PR for review: ${prResult.prUrl} (${confidenceResult.score}% confidence)`,
                  prNumber: prResult.prNumber,
                  prUrl: prResult.prUrl,
                });
              }
              
              this.consecutiveFailures = 0; // Reset since we successfully created a PR
            } catch (prError) {
              console.error('[HEAL-ORCHESTRATOR] Failed to create PR:', prError);
              // Fall through to rollback
              verification.passed = false;
            }
          }
        }
        
        if (!verification.passed) {
          // Verification FAILED - rollback changes
          console.error('[HEAL-ORCHESTRATOR] ❌ Verification failed, rolling back changes...');
          
          // AUDIT TRAIL: Log failed attempt
          await db
            .update(platformHealAttempts)
            .set({
              success: false,
              verificationPassed: false,
              error: 'Verification failed: ' + JSON.stringify(verification.results),
              completedAt: new Date(),
            })
            .where(eq(platformHealAttempts.sessionId, session.id));
          
          // ROLLBACK: Revert files (use git checkout or restore from backup)
          try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            
            for (const file of healingResult.filesModified || []) {
              await execAsync(`git checkout -- ${file}`, { cwd: process.cwd() });
              console.log('[HEAL-ORCHESTRATOR] Reverted file:', file);
            }
          } catch (rollbackError) {
            console.error('[HEAL-ORCHESTRATOR] Rollback failed:', rollbackError);
          }
          
          // Update session as failed
          await db
            .update(platformHealingSessions)
            .set({
              phase: 'failed',
              status: 'failed',
              error: 'Verification failed: ' + JSON.stringify(verification.results),
              verificationResults: verification.results,
              verificationPassed: false,
              completedAt: new Date(),
            })
            .where(eq(platformHealingSessions.id, session.id));
          
          // Increment consecutive failures
          this.consecutiveFailures++;
          
          // Check if we should activate kill-switch
          if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
            this.activateKillSwitch();
          }
          
          // Keep incident open for retry
          console.log('[HEAL-ORCHESTRATOR] Incident remains open for retry');
        }
      } else {
        // Healing failed
        await db
          .update(platformHealingSessions)
          .set({
            phase: 'failed',
            status: 'failed',
            error: healingResult.error,
            completedAt: new Date(),
          })
          .where(eq(platformHealingSessions.id, session.id));
        
        // AUDIT TRAIL: Log failed attempt
        await db
          .update(platformHealAttempts)
          .set({
            success: false,
            error: healingResult.error,
            completedAt: new Date(),
          })
          .where(eq(platformHealAttempts.sessionId, session.id));
        
        // Increment consecutive failures
        this.consecutiveFailures++;
        
        // Check if we should activate kill-switch
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          this.activateKillSwitch();
        }
        
        console.log('[HEAL-ORCHESTRATOR] ❌ Healing failed:', healingResult.error);
      }
      
    } catch (error) {
      console.error('[HEAL-ORCHESTRATOR] Failed to start healing session:', error);
      this.isHealing = false;
      this.currentSessionId = null;
    } finally {
      // Release lock after processing
      setTimeout(() => {
        this.isHealing = false;
        this.currentSessionId = null;
      }, 5000); // 5 second cooldown
    }
  }
  
  /**
   * Generate diagnostic prompt based on incident type
   */
  private generateDiagnosticPrompt(incident: any): string {
    const prompts: Record<string, string> = {
      high_cpu: `Diagnose high CPU usage (${incident.metrics?.cpuUsage || '?'}%). Check for infinite loops, inefficient algorithms, or runaway processes. Suggest optimizations.`,
      high_memory: `Diagnose high memory usage (${incident.metrics?.memoryUsage || '?'}%). Check for memory leaks, large data structures, or caching issues. Suggest fixes.`,
      safety_issue: `Diagnose platform safety issues: ${incident.description}. Review recent changes and suggest corrections.`,
      build_failure: `Diagnose build failure: ${incident.description}. Check TypeScript errors, missing dependencies, and configuration issues.`,
      runtime_error: `Diagnose runtime error: ${incident.description}. Analyze stack trace and logs to identify root cause.`,
    };
    
    return prompts[incident.type] || `Diagnose and fix issue: ${incident.description}`;
  }
}

// Export singleton instance
export const healOrchestrator = new HealOrchestrator();
