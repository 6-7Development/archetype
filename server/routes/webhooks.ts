import { Router } from 'express';
import { db } from '../db';
import { platformHealingSessions, platformIncidents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { PlatformMetricsBroadcaster } from '../services/platformMetricsBroadcaster';

const router = Router();

// Store broadcaster instance (will be set in registerRoutes)
let metricsBroadcaster: PlatformMetricsBroadcaster | null = null;

export function setWebhookBroadcaster(broadcaster: PlatformMetricsBroadcaster) {
  metricsBroadcaster = broadcaster;
}

/**
 * POST /api/webhooks/deployment
 * 
 * Receive deployment status notifications from Railway/Render
 * 
 * Railway webhook payload:
 * {
 *   "status": "SUCCESS" | "FAILED" | "BUILDING",
 *   "deploymentId": "abc-123",
 *   "url": "https://archetype-production.up.railway.app",
 *   "timestamp": "2025-10-31T12:00:00Z"
 * }
 * 
 * Render webhook payload:
 * {
 *   "status": "live" | "build_failed" | "building",
 *   "deployId": "dep-xyz",
 *   "url": "https://archetype.onrender.com",
 *   "createdAt": "2025-10-31T12:00:00Z"
 * }
 */
router.post('/deployment', async (req, res) => {
  try {
    console.log('[WEBHOOK] Deployment notification received:', req.body);
    
    // Verify webhook signature (Railway uses X-Railway-Signature, Render uses Render-Signature)
    const signature = req.headers['x-railway-signature'] || req.headers['render-signature'];
    const webhookSecret = process.env.DEPLOYMENT_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      // TODO: Implement proper signature verification based on provider
      console.log('[WEBHOOK] Webhook signature verification: SKIPPED (implement crypto.verify)');
    }
    
    // Normalize payload from different providers
    const { status, deploymentId, deployId, url, timestamp, createdAt } = req.body;
    
    const normalizedStatus = normalizeDeploymentStatus(status);
    const normalizedId = deploymentId || deployId;
    const normalizedUrl = url;
    const normalizedTime = timestamp || createdAt || new Date().toISOString();
    
    console.log('[WEBHOOK] Normalized deployment data:', {
      status: normalizedStatus,
      id: normalizedId,
      url: normalizedUrl,
      timestamp: normalizedTime,
    });
    
    // Find active healing session waiting for deployment
    const [activeSession] = await db
      .select()
      .from(platformHealingSessions)
      .where(eq(platformHealingSessions.deploymentId, normalizedId))
      .limit(1);
    
    if (!activeSession) {
      console.log('[WEBHOOK] No active healing session found for deployment:', normalizedId);
      return res.status(200).json({ 
        message: 'Webhook received but no active session', 
        deploymentId: normalizedId 
      });
    }
    
    console.log('[WEBHOOK] Found healing session:', activeSession.id);
    
    // Update healing session with deployment status
    const updateData: any = {
      deploymentStatus: normalizedStatus,
      deploymentUrl: normalizedUrl,
    };
    
    if (normalizedStatus === 'deploying' && !activeSession.deploymentStartedAt) {
      updateData.deploymentStartedAt = new Date(normalizedTime);
      updateData.phase = 'deploy';
    }
    
    if (normalizedStatus === 'success') {
      updateData.deploymentCompletedAt = new Date(normalizedTime);
      updateData.phase = 'complete';
      updateData.status = 'success';
      updateData.completedAt = new Date();
      
      // Also mark incident as resolved
      await db
        .update(platformIncidents)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(platformIncidents.id, activeSession.incidentId));
    }
    
    if (normalizedStatus === 'failed') {
      updateData.deploymentCompletedAt = new Date(normalizedTime);
      updateData.status = 'failed';
      updateData.completedAt = new Date();
      updateData.error = 'Deployment failed';
    }
    
    await db
      .update(platformHealingSessions)
      .set(updateData)
      .where(eq(platformHealingSessions.id, activeSession.id));
    
    console.log('[WEBHOOK] Updated healing session with deployment status:', normalizedStatus);
    
    // Broadcast deployment status via WebSocket
    if (metricsBroadcaster) {
      metricsBroadcaster.broadcastDeploymentStatus({
        sessionId: activeSession.id,
        incidentId: activeSession.incidentId,
        deploymentStatus: normalizedStatus,
        deploymentUrl: normalizedUrl,
        timestamp: normalizedTime,
      });
      console.log('[WEBHOOK] Broadcasted deployment status via WebSocket');
    }
    
    res.status(200).json({ 
      message: 'Deployment status updated', 
      sessionId: activeSession.id,
      status: normalizedStatus,
    });
  } catch (error: any) {
    console.error('[WEBHOOK] Error processing deployment webhook:', error);
    res.status(500).json({ error: error.message || 'Failed to process webhook' });
  }
});

/**
 * Normalize deployment status from different providers
 */
function normalizeDeploymentStatus(status: string): 'pending' | 'deploying' | 'success' | 'failed' {
  const normalized = status.toLowerCase();
  
  // Railway statuses
  if (normalized === 'success') return 'success';
  if (normalized === 'failed') return 'failed';
  if (normalized === 'building') return 'deploying';
  
  // Render statuses
  if (normalized === 'live') return 'success';
  if (normalized === 'build_failed') return 'failed';
  if (normalized === 'building' || normalized === 'deploying') return 'deploying';
  
  // Default
  return 'pending';
}

export default router;
