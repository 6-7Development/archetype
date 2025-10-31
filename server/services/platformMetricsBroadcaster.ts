import { WebSocketServer } from 'ws';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { healthMonitor } from './healthMonitor';

const execFileAsync = promisify(execFile);

export class PlatformMetricsBroadcaster {
  private wss: WebSocketServer;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly BROADCAST_INTERVAL = 5000; // 5 seconds

  constructor(wss: WebSocketServer) {
    this.wss = wss;
  }

  start() {
    console.log('[PLATFORM-METRICS] Starting WebSocket broadcaster (5s intervals)');
    
    // Broadcast immediately on start
    this.broadcastMetrics();
    
    // Then broadcast every 5 seconds
    this.intervalId = setInterval(() => {
      this.broadcastMetrics();
    }, this.BROADCAST_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[PLATFORM-METRICS] WebSocket broadcaster stopped');
    }
  }

  /**
   * Broadcast healing event to all connected clients
   */
  broadcastHealingEvent(event: any) {
    if (!this.wss) return;
    
    console.log('[PLATFORM-METRICS] Broadcasting healing event:', event.type);
    
    this.wss.clients.forEach((client: any) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify({
          type: 'platform-healing',
          ...event,
        }));
      }
    });
  }

  /**
   * Broadcast deployment status to all connected clients
   */
  broadcastDeploymentStatus(event: {
    sessionId: string;
    incidentId: string;
    deploymentStatus: string;
    deploymentUrl?: string;
    timestamp: string;
  }) {
    if (!this.wss) return;
    
    console.log('[PLATFORM-METRICS] Broadcasting deployment status:', event.deploymentStatus);
    
    this.wss.clients.forEach((client: any) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify({
          type: 'deployment-status',
          ...event,
        }));
      }
    });
  }

  private async broadcastMetrics() {
    try {
      const metrics = await this.collectMetrics();
      
      // Broadcast to all connected admin clients
      // In production, you'd filter by admin/authenticated users
      this.wss.clients.forEach((client: any) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({
            type: 'platform-metrics',
            platformMetrics: metrics,
          }));
        }
      });
      
      // Update health monitor with latest metrics
      healthMonitor.updateMetrics(metrics);
    } catch (error: any) {
      console.error('[PLATFORM-METRICS] Broadcast error:', error.message);
    }
  }

  private async collectMetrics() {
    // Get system metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    const cpus = os.cpus();
    const avgLoad = os.loadavg()[0];
    const cpuCount = cpus.length;
    const cpuUsage = Math.min(100, (avgLoad / cpuCount) * 100);
    
    const uptime = os.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const uptimeFormatted = `${days}d ${hours}h ${minutes}m`;
    
    // Check for uncommitted changes
    let uncommittedChanges = false;
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { 
        cwd: path.resolve(__dirname, '..', '..') 
      });
      uncommittedChanges = stdout.trim().length > 0;
    } catch (error) {
      // Git not available (Render production)
      uncommittedChanges = false;
    }
    
    // Calculate overall health
    let healthScore = 100;
    if (cpuUsage > 80) healthScore -= 20;
    if (memoryUsage > 80) healthScore -= 20;
    if (uncommittedChanges) healthScore -= 10;
    
    const issues: string[] = [];
    if (cpuUsage > 80) issues.push('High CPU usage detected');
    if (memoryUsage > 80) issues.push('High memory usage detected');
    if (uncommittedChanges) issues.push('Uncommitted changes present');
    
    return {
      overallHealth: Math.round(healthScore),
      activeIncidents: issues.length,
      uptime: uptimeFormatted,
      cpuUsage: Math.round(cpuUsage),
      memoryUsage: Math.round(memoryUsage),
      uncommittedChanges,
      safety: {
        safe: issues.length === 0,
        issues,
      },
      lastUpdate: new Date().toISOString(),
    };
  }
}
