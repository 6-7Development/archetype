import { EventEmitter } from 'events';
import { db } from '../db';
import { platformHealingSessions, platformHealAttempts, platformIncidents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { aiHealingService } from './aiHealingService';
import { platformHealing } from '../platformHealing';
import type { PlatformMetricsBroadcaster } from './platformMetricsBroadcaster';

/**
 * HealOrchestrator
 * 
 * Consumes incidents from healthMonitor and triggers automated healing.
 * Tracks healing sessions and coordinates the fix loop.
 */
export class HealOrchestrator extends EventEmitter {
  private isHealing: boolean = false;
  private currentSessionId: string | null = null;
  private broadcaster: PlatformMetricsBroadcaster | null = null;
  
  constructor() {
    super();
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
    
    // Start healing
    this.isHealing = true;
    await this.startHealingSession(incidentId, incident);
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
      
      // Call AI healing service
      const healingResult = await aiHealingService.diagnoseAndFix(
        diagnosticPrompt,
        incident
      );

      if (healingResult.success) {
        // Run verification BEFORE committing
        const verification = await this.verifyFix(healingResult.filesModified || []);

        if (verification.passed) {
          // Verification passed - safe to commit
          try {
            console.log('[HEAL-ORCHESTRATOR] Verification passed, committing changes...');
            
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
            
            // Update session as success
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
              })
              .where(eq(platformIncidents.id, incidentId));
            
            // Broadcast success
            if (this.broadcaster) {
              this.broadcaster.broadcastHealingEvent({
                type: 'healing-complete',
                incidentId,
                sessionId: session.id,
                incident: { type: incident.type, title: incident.title },
                result: 'success',
                message: `✅ Auto-fixed ${incident.type}: ${incident.title}`,
              });
            }
            
            this.emit('healing-complete', {
              incidentId,
              sessionId: session.id,
              result: healingResult,
            });
            
          } catch (commitError) {
            // Only rollback on REAL commit errors
            console.error('[HEAL-ORCHESTRATOR] Commit failed with error:', commitError);
            verification.passed = false; // Treat as verification failure
          }
        }
        
        if (!verification.passed) {
          // Verification FAILED - rollback changes
          console.error('[HEAL-ORCHESTRATOR] ❌ Verification failed, rolling back changes...');
          
          // Revert files (use git checkout or restore from backup)
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
