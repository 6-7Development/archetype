import { EventEmitter } from 'events';
import { db } from '../db';
import { platformIncidents, type InsertPlatformIncident } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * PlatformHealthMonitor
 * 
 * Subscribes to platform metrics and detects incidents that require healing.
 * Emits 'incident-detected' events when issues are found.
 */
export class PlatformHealthMonitor extends EventEmitter {
  private readonly thresholds = {
    cpu: 85, // High CPU if > 85%
    memory: 90, // High memory if > 90%
    errorRate: 5, // High error rate if > 5 errors/min
  };
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastMetrics: any = null;
  private openIncidents: Map<string, string> = new Map(); // type -> incidentId
  
  // Agent quality monitoring rate limiting
  private agentIncidentTimestamps: Map<string, Date> = new Map(); // type -> last incident time
  private readonly AGENT_INCIDENT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
  
  constructor() {
    super();
  }
  
  /**
   * Start monitoring platform metrics
   */
  async start() {
    console.log('[HEALTH-MONITOR] Starting platform health monitoring...');
    
    // Check for existing open incidents on startup
    await this.loadOpenIncidents();
    
    // Monitor every 10 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkHealth();
    }, 10000);
    
    console.log('[HEALTH-MONITOR] Monitoring started');
  }
  
  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[HEALTH-MONITOR] Monitoring stopped');
    }
  }
  
  /**
   * Load existing open incidents from database to prevent duplicates
   */
  private async loadOpenIncidents() {
    try {
      const incidents = await db
        .select()
        .from(platformIncidents)
        .where(and(
          eq(platformIncidents.status, 'open'),
          isNull(platformIncidents.resolvedAt)
        ));
      
      for (const incident of incidents) {
        this.openIncidents.set(incident.type, incident.id);
      }
      
      console.log(`[HEALTH-MONITOR] Loaded ${incidents.length} open incidents`);
    } catch (error) {
      console.error('[HEALTH-MONITOR] Failed to load open incidents:', error);
    }
  }
  
  /**
   * Receive metrics update (called by platform metrics broadcaster)
   */
  updateMetrics(metrics: any) {
    this.lastMetrics = metrics;
  }
  
  /**
   * Check current health and detect incidents
   */
  private async checkHealth() {
    if (!this.lastMetrics) return;
    
    const { cpuUsage, memoryUsage, safety } = this.lastMetrics;
    
    // Check CPU
    if (cpuUsage > this.thresholds.cpu) {
      await this.detectIncident({
        type: 'high_cpu',
        severity: cpuUsage > 95 ? 'critical' : 'high',
        title: `High CPU usage detected (${cpuUsage}%)`,
        description: `CPU usage is at ${cpuUsage}%, exceeding threshold of ${this.thresholds.cpu}%`,
        source: 'metrics',
        metrics: { cpuUsage, memoryUsage },
      });
    } else {
      // CPU is normal, resolve any open high_cpu incidents
      await this.resolveIncident('high_cpu');
    }
    
    // Check memory
    if (memoryUsage > this.thresholds.memory) {
      await this.detectIncident({
        type: 'high_memory',
        severity: memoryUsage > 95 ? 'critical' : 'high',
        title: `High memory usage detected (${memoryUsage}%)`,
        description: `Memory usage is at ${memoryUsage}%, exceeding threshold of ${this.thresholds.memory}%`,
        source: 'metrics',
        metrics: { cpuUsage, memoryUsage },
      });
    } else {
      await this.resolveIncident('high_memory');
    }
    
    // Check safety issues
    if (!safety?.safe && safety?.issues?.length > 0) {
      await this.detectIncident({
        type: 'safety_issue',
        severity: 'high',
        title: 'Platform safety issues detected',
        description: safety.issues.join('; '),
        source: 'metrics',
        metrics: { safety },
      });
    } else {
      await this.resolveIncident('safety_issue');
    }
  }
  
  /**
   * Detect and record an incident (deduplicates by type)
   */
  private async detectIncident(incident: Partial<InsertPlatformIncident>) {
    const { type } = incident;
    
    // Check if we already have an open incident of this type
    if (this.openIncidents.has(type!)) {
      // Already tracking this issue
      return;
    }
    
    try {
      // Create new incident in database
      const [newIncident] = await db
        .insert(platformIncidents)
        .values({
          type: type!,
          severity: incident.severity || 'medium',
          title: incident.title || 'Unknown issue',
          description: incident.description || '',
          source: incident.source || 'metrics',
          status: 'open',
          metrics: incident.metrics || {},
          attemptCount: 0,
        })
        .returning();
      
      // Track this incident
      this.openIncidents.set(type!, newIncident.id);
      
      console.log(`[HEALTH-MONITOR] 🚨 Incident detected: ${type} (${newIncident.id})`);
      
      // Emit event for heal orchestrator
      this.emit('incident-detected', {
        incidentId: newIncident.id,
        incident: newIncident,
      });
    } catch (error) {
      console.error('[HEALTH-MONITOR] Failed to create incident:', error);
    }
  }
  
  /**
   * Resolve an incident when the issue is fixed
   */
  private async resolveIncident(type: string) {
    const incidentId = this.openIncidents.get(type);
    if (!incidentId) return; // No open incident of this type
    
    try {
      // Update incident as resolved
      await db
        .update(platformIncidents)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(platformIncidents.id, incidentId));
      
      // Remove from tracking
      this.openIncidents.delete(type);
      
      console.log(`[HEALTH-MONITOR] ✅ Incident resolved: ${type} (${incidentId})`);
      
      // Emit resolution event
      this.emit('incident-resolved', {
        incidentId,
        type,
      });
    } catch (error) {
      console.error('[HEALTH-MONITOR] Failed to resolve incident:', error);
    }
  }
  
  /**
   * Report agent-specific incidents (quality issues, failures, etc.)
   * Used by LomuAI quality monitoring system
   * 
   * Rate limiting: Max 1 incident per type per 10 minutes
   * Source: Always set to 'agent_monitor' for I AM Architect routing
   */
  async reportAgentIncident(data: {
    type: string;
    severity: string;
    description: string;
    metrics: any;
    userMessage?: string;
    agentResponse?: string;
  }): Promise<void> {
    const { type, severity, description, metrics, userMessage, agentResponse } = data;
    
    // Rate limiting: Check if we've reported this type of incident recently
    const lastIncidentTime = this.agentIncidentTimestamps.get(type);
    if (lastIncidentTime) {
      const timeSinceLastIncident = Date.now() - lastIncidentTime.getTime();
      if (timeSinceLastIncident < this.AGENT_INCIDENT_COOLDOWN_MS) {
        const minutesRemaining = Math.ceil((this.AGENT_INCIDENT_COOLDOWN_MS - timeSinceLastIncident) / 60000);
        console.log(`[HEALTH-MONITOR] ⏳ Agent incident rate-limited: ${type} (${minutesRemaining}min cooldown remaining)`);
        return;
      }
    }
    
    try {
      // Create incident in database with agent_monitor source
      const [incident] = await db
        .insert(platformIncidents)
        .values({
          type,
          severity,
          title: `Agent Quality Issue: ${type}`,
          description,
          source: 'agent_monitor', // CRITICAL: Routes to I AM Architect
          incidentCategory: 'agent_failure',
          isAgentFailure: true,
          status: 'open',
          metrics: {
            ...metrics,
            userMessage: userMessage?.slice(0, 500), // Truncate to prevent excessive storage
            agentResponse: agentResponse?.slice(0, 1000),
            detectedAt: new Date().toISOString(),
          },
          attemptCount: 0,
        })
        .returning();
      
      // Update rate limit timestamp
      this.agentIncidentTimestamps.set(type, new Date());
      
      console.log(`[HEALTH-MONITOR] 🤖 Agent incident reported: ${type} (${incident.id})`);
      console.log(`[HEALTH-MONITOR] Quality metrics:`, metrics);
      
      // Emit event for heal orchestrator
      this.emit('incident-detected', {
        incidentId: incident.id,
        incident,
      });
    } catch (error: any) {
      console.error('[HEALTH-MONITOR] Failed to report agent incident:', error);
    }
  }
}

// Export singleton instance
export const healthMonitor = new PlatformHealthMonitor();
