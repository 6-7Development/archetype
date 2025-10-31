import { Router } from 'express';
import { db } from '../db';
import { platformHealingSessions, platformIncidents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { PlatformMetricsBroadcaster } from '../services/platformMetricsBroadcaster';
import { verifyRailwayWebhook, verifyRenderWebhook } from '../services/webhookVerification';

const router = Router();

// Store broadcaster instance (will be set in registerRoutes)
let metricsBroadcaster: PlatformMetricsBroadcaster | null = null;

export function setWebhookBroadcaster(broadcaster: PlatformMetricsBroadcaster) {
  metricsBroadcaster = broadcaster;
}

/**
 * POST /api/webhooks/deployment
 * 
 * Receive deployment status notifications from Railway/Render.
 * 
 * SECURITY: All webhooks MUST be signed with WEBHOOK_SECRET to prevent spoofing attacks.
 * 
 * ## Configuration Instructions:
 * 
 * ### Railway Setup:
 * 1. Go to your Railway project settings
 * 2. Navigate to "Webhooks" section
 * 3. Add webhook URL: https://your-domain.com/api/webhooks/deployment
 * 4. Generate a secret key: `openssl rand -hex 32`
 * 5. Save the secret in Railway environment as WEBHOOK_SECRET
 * 6. Railway will send signature in 'x-webhook-signature' header
 * 
 * ### Render Setup:
 * 1. Go to your Render service settings
 * 2. Navigate to "Notifications" > "Webhooks"
 * 3. Add webhook URL: https://your-domain.com/api/webhooks/deployment
 * 4. Generate a secret key: `openssl rand -hex 32`
 * 5. Save the secret in Render environment as WEBHOOK_SECRET
 * 6. Render will send signature in 'render-signature' header
 * 
 * ## Webhook Payloads:
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
 * 
 * ## Security Notes:
 * - Webhooks without valid signatures are rejected with 401 Unauthorized
 * - Failed verification attempts are logged for security monitoring
 * - Uses HMAC-SHA256 with constant-time comparison to prevent timing attacks
 */
router.post('/deployment', async (req, res) => {
  try {
    console.log('[WEBHOOK] Deployment notification received');
    
    // Extract signature from headers (Railway uses x-webhook-signature, Render uses render-signature)
    const railwaySignature = req.headers['x-webhook-signature'] as string | undefined;
    const renderSignature = req.headers['render-signature'] as string | undefined;
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    // Determine provider based on which signature header is present
    const isRailway = !!railwaySignature;
    const isRender = !!renderSignature;
    const signature = railwaySignature || renderSignature;
    const provider = isRailway ? 'Railway' : isRender ? 'Render' : 'Unknown';
    
    // CRITICAL SECURITY: Verify webhook signature to prevent spoofing attacks
    if (!webhookSecret) {
      console.error('[WEBHOOK-SECURITY] ⚠️ WEBHOOK_SECRET not configured - webhooks are INSECURE');
      console.error('[WEBHOOK-SECURITY] Generate secret: openssl rand -hex 32');
      console.error('[WEBHOOK-SECURITY] Add to environment variables');
      return res.status(500).json({ 
        error: 'Webhook signature verification not configured' 
      });
    }
    
    if (!signature) {
      console.error('[WEBHOOK-SECURITY] 🚨 POTENTIAL ATTACK: Webhook received without signature');
      console.error('[WEBHOOK-SECURITY] Source IP:', req.ip);
      console.error('[WEBHOOK-SECURITY] Headers:', JSON.stringify(req.headers));
      return res.status(401).json({ 
        error: 'Missing webhook signature' 
      });
    }
    
    // Get raw request body for signature verification
    const rawBody = JSON.stringify(req.body);
    
    // Verify signature based on provider
    const verificationResult = isRailway
      ? verifyRailwayWebhook(rawBody, signature, webhookSecret)
      : verifyRenderWebhook(rawBody, signature, webhookSecret);
    
    if (!verificationResult.valid) {
      console.error('[WEBHOOK-SECURITY] 🚨 POTENTIAL ATTACK: Invalid webhook signature');
      console.error('[WEBHOOK-SECURITY] Provider:', provider);
      console.error('[WEBHOOK-SECURITY] Source IP:', req.ip);
      console.error('[WEBHOOK-SECURITY] Error:', verificationResult.error);
      console.error('[WEBHOOK-SECURITY] Signature received:', signature.substring(0, 16) + '...');
      return res.status(401).json({ 
        error: 'Invalid webhook signature',
        details: verificationResult.error,
      });
    }
    
    console.log('[WEBHOOK-SECURITY] ✅ Webhook signature verified successfully');
    console.log('[WEBHOOK] Provider:', provider);
    console.log('[WEBHOOK] Payload:', req.body);
    
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
