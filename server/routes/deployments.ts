import type { Express } from 'express';
import { storage } from '../storage';
import { buildService } from '../services/buildService';
import { cloudflareService } from '../services/cloudflareService';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { subdomainSchema } from '@shared/schema';

// SECURITY: Rate limiter for deployment creation (prevent abuse)
const deploymentRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // Max 5 deployments per hour per user
  message: 'Too many deployments. Please wait before creating another.',
  keyGenerator: (req: any) => {
    // Rate limit per authenticated user (auth is required for this endpoint)
    const userId = req.session?.claims?.sub || req.session?.user?.id;
    return userId || 'anonymous';
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Request validation schemas
const createDeploymentSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  subdomain: subdomainSchema,
  environment: z.enum(['production', 'preview']).default('production'),
  branch: z.string().default('main'),
});

const customDomainSchema = z.object({
  domain: z.string().min(4, 'Domain is required').regex(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/,
    "Invalid domain format"
  ),
});

/**
 * Register deployment routes
 * 
 * Endpoints:
 * - GET /api/deployments - List user's deployments
 * - POST /api/deployments - Create new deployment
 * - GET /api/deployments/:deploymentId - Get deployment details
 * - POST /api/deployments/:deploymentId/rebuild - Rebuild deployment
 * - DELETE /api/deployments/:deploymentId - Delete deployment
 * - GET /api/deployments/:deploymentId/logs - Get build logs
 * - POST /api/deployments/:deploymentId/custom-domain - Add custom domain
 * - GET /api/custom-domains/:domainId/verify - Verify DNS
 * - DELETE /api/custom-domains/:domainId - Delete custom domain
 */
export function registerDeploymentRoutes(app: Express) {
  // List user's deployments
  app.get('/api/deployments', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const deployments = await storage.getDeployments(userId);
      res.json(deployments);
    } catch (error: any) {
      console.error('[DEPLOYMENTS] Error fetching deployments:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch deployments' });
    }
  });

  // Get single deployment
  app.get('/api/deployments/:deploymentId', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { deploymentId } = req.params;
      const deployment = await storage.getDeployment(deploymentId);

      if (!deployment || deployment.userId !== userId) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      res.json(deployment);
    } catch (error: any) {
      console.error('[DEPLOYMENTS] Error fetching deployment:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch deployment' });
    }
  });

  // Create deployment (triggers build + deploy)
  // SECURITY: Rate limited to 5 deployments per hour per user
  app.post('/api/deployments', deploymentRateLimiter, async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate request body
      const validation = createDeploymentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid request', 
          details: validation.error.errors 
        });
      }

      const { projectId, subdomain, environment, branch } = validation.data;

      // Check if project exists and user owns it
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check if subdomain is already taken
      const existing = await storage.getDeploymentBySubdomain(subdomain);
      if (existing && existing.userId !== userId) {
        return res.status(409).json({ error: 'Subdomain already taken' });
      }

      // Create Cloudflare Pages project (mock for MVP)
      const cfProjectId = await cloudflareService.createPagesProject(subdomain, userId);

      // Create deployment record
      const deployment = await storage.createDeployment({
        projectId,
        userId,
        subdomain,
        cfProjectId,
        status: 'pending',
        environment,
        branch,
      });

      // Trigger build service (runs in background)
      const buildJob = await buildService.createBuild(projectId, userId);

      // Update deployment with build job ID
      const updatedDeployment = await storage.updateDeployment(deployment.id, {
        buildJobId: buildJob.id,
        status: 'building',
      });

      // Start monitoring build status (in background)
      monitorBuild(deployment.id, buildJob.id, subdomain, cfProjectId);

      res.status(201).json(updatedDeployment);
    } catch (error: any) {
      console.error('[DEPLOYMENTS] Error creating deployment:', error);
      res.status(500).json({ error: error.message || 'Failed to create deployment' });
    }
  });

  // Rebuild deployment
  app.post('/api/deployments/:deploymentId/rebuild', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { deploymentId } = req.params;
      const deployment = await storage.getDeployment(deploymentId);

      if (!deployment || deployment.userId !== userId) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      // Trigger new build
      const buildJob = await buildService.createBuild(deployment.projectId, userId);

      // Update deployment
      const updatedDeployment = await storage.updateDeployment(deploymentId, {
        buildJobId: buildJob.id,
        status: 'building',
      });

      // Monitor build
      monitorBuild(deploymentId, buildJob.id, deployment.subdomain, deployment.cfProjectId || '');

      res.json(updatedDeployment);
    } catch (error: any) {
      console.error('[DEPLOYMENTS] Error rebuilding deployment:', error);
      res.status(500).json({ error: error.message || 'Failed to rebuild deployment' });
    }
  });

  // Delete deployment
  app.delete('/api/deployments/:deploymentId', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { deploymentId } = req.params;
      const deployment = await storage.getDeployment(deploymentId);

      if (!deployment || deployment.userId !== userId) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      // Delete Cloudflare project (mock for MVP)
      if (deployment.cfProjectId) {
        await cloudflareService.deleteProject(deployment.cfProjectId);
      }

      // Delete deployment record
      await storage.deleteDeployment(deploymentId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('[DEPLOYMENTS] Error deleting deployment:', error);
      res.status(500).json({ error: error.message || 'Failed to delete deployment' });
    }
  });

  // Get build logs
  app.get('/api/deployments/:deploymentId/logs', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { deploymentId } = req.params;
      const deployment = await storage.getDeployment(deploymentId);

      if (!deployment || deployment.userId !== userId) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      if (!deployment.buildJobId) {
        return res.json([]);
      }

      const logs = await storage.getDeploymentLogs(deployment.buildJobId);
      res.json(logs);
    } catch (error: any) {
      console.error('[DEPLOYMENTS] Error fetching logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch logs' });
    }
  });

  // Add custom domain
  app.post('/api/deployments/:deploymentId/custom-domain', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { deploymentId } = req.params;
      const deployment = await storage.getDeployment(deploymentId);

      if (!deployment || deployment.userId !== userId) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      // Validate domain
      const validation = customDomainSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid domain', 
          details: validation.error.errors 
        });
      }

      const { domain } = validation.data;

      // Check if domain is already in use
      const existing = await storage.getCustomDomainByDomain(domain);
      if (existing) {
        return res.status(409).json({ error: 'Domain already in use' });
      }

      // Generate verification token
      const dnsVerificationToken = Buffer.from(`lomu-${domain}-${Date.now()}`).toString('base64').substring(0, 32);

      // Create custom domain record
      const customDomain = await storage.createCustomDomain({
        userId,
        deploymentId,
        domain,
        dnsVerificationToken,
        status: 'pending',
      });

      // Add domain to Cloudflare (mock for MVP)
      if (deployment.cfProjectId) {
        await cloudflareService.addCustomDomain(deployment.cfProjectId, domain);
      }

      // Get DNS instructions
      const dnsInstructions = cloudflareService.getDNSInstructions(domain, deployment.subdomain);

      res.status(201).json({
        ...customDomain,
        dnsInstructions,
      });
    } catch (error: any) {
      console.error('[DEPLOYMENTS] Error adding custom domain:', error);
      res.status(500).json({ error: error.message || 'Failed to add custom domain' });
    }
  });

  // Verify DNS for custom domain
  app.get('/api/custom-domains/:domainId/verify', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { domainId } = req.params;
      const customDomain = await storage.getCustomDomain(domainId);

      if (!customDomain || customDomain.userId !== userId) {
        return res.status(404).json({ error: 'Custom domain not found' });
      }

      // Get associated deployment
      const deployment = await storage.getDeployment(customDomain.deploymentId);
      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      // Verify DNS (mock for MVP - always returns true)
      const isVerified = await cloudflareService.verifyDNS(
        deployment.cfProjectId || '',
        customDomain.domain
      );

      // Update domain status
      if (isVerified) {
        await storage.updateCustomDomain(domainId, {
          status: 'active',
          verifiedAt: new Date(),
        });
      }

      res.json({ verified: isVerified });
    } catch (error: any) {
      console.error('[DEPLOYMENTS] Error verifying DNS:', error);
      res.status(500).json({ error: error.message || 'Failed to verify DNS' });
    }
  });

  // Delete custom domain
  app.delete('/api/custom-domains/:domainId', async (req: any, res) => {
    try {
      const userId = req.session?.claims?.sub || req.session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { domainId } = req.params;
      const customDomain = await storage.getCustomDomain(domainId);

      if (!customDomain || customDomain.userId !== userId) {
        return res.status(404).json({ error: 'Custom domain not found' });
      }

      // Delete custom domain
      await storage.deleteCustomDomain(domainId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('[DEPLOYMENTS] Error deleting custom domain:', error);
      res.status(500).json({ error: error.message || 'Failed to delete custom domain' });
    }
  });

  console.log('[DEPLOYMENTS] Routes registered successfully');
}

/**
 * Monitor build progress and update deployment status
 * Runs in background, polls build status every 5 seconds
 */
async function monitorBuild(
  deploymentId: string,
  buildJobId: string,
  subdomain: string,
  cfProjectId: string
): Promise<void> {
  const MAX_POLLS = 60; // 5 minutes max (60 * 5s = 300s)
  let polls = 0;

  const interval = setInterval(async () => {
    try {
      polls++;

      // Get build status
      const buildJob = await storage.getBuildJob(buildJobId);
      if (!buildJob) {
        clearInterval(interval);
        return;
      }

      // Check if build completed
      if (buildJob.status === 'success') {
        clearInterval(interval);

        // Deploy to Cloudflare Pages (mock for MVP)
        const cfDeploymentId = await cloudflareService.deployToPages(
          cfProjectId,
          buildJob.artifactPath || ''
        );

        // Get deployment URL
        const cfUrl = cloudflareService.getDeploymentUrl(subdomain, cfDeploymentId);

        // Update deployment status to "active"
        await storage.updateDeployment(deploymentId, {
          status: 'active',
          cfDeploymentId,
          cfUrl,
          deployedAt: new Date(),
        });

        console.log(`[DEPLOYMENTS] Deployment ${deploymentId} completed successfully`);
      } else if (buildJob.status === 'failed' || buildJob.status === 'cancelled') {
        clearInterval(interval);

        // Update deployment status to "failed"
        await storage.updateDeployment(deploymentId, {
          status: 'failed',
        });

        console.log(`[DEPLOYMENTS] Deployment ${deploymentId} failed`);
      }

      // Timeout check
      if (polls >= MAX_POLLS) {
        clearInterval(interval);
        await storage.updateDeployment(deploymentId, {
          status: 'failed',
        });
        console.log(`[DEPLOYMENTS] Deployment ${deploymentId} timed out`);
      }
    } catch (error) {
      console.error('[DEPLOYMENTS] Error monitoring build:', error);
      clearInterval(interval);
    }
  }, 5000); // Poll every 5 seconds
}
