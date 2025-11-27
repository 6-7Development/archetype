/**
 * ENTERPRISE PHASE 8: Organization Routes
 */

import type { Express, Request, Response } from 'express';
import { organizationService } from '../services/organizationService';
import { auditService } from '../services/auditService';
import { isAuthenticated } from '../universalAuth';

export function registerOrganizationRoutes(app: Express) {
  // Create organization
  app.post('/api/organizations', isAuthenticated, async (req: any, res) => {
    const userId = req.authenticatedUserId;
    const { name, slug, description } = req.body;

    try {
      const org = await organizationService.createOrganization({
        name,
        slug,
        ownerId: userId,
        description,
      });

      await auditService.log({
        workspaceId: 'platform',
        userId,
        action: 'organization.created',
        resourceType: 'organization',
        resourceId: org.id,
        changesAfter: org,
        status: 'success',
      });

      res.json(org);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get organization
  app.get('/api/organizations/:organizationId', isAuthenticated, async (req: any, res) => {
    const { organizationId } = req.params;

    try {
      const fullOrg = await organizationService.getOrganizationFull(organizationId);
      res.json(fullOrg);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's organizations
  app.get('/api/organizations', isAuthenticated, async (req: any, res) => {
    const userId = req.authenticatedUserId;

    try {
      const orgs = await organizationService.getUserOrganizations(userId);
      res.json(orgs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add member to organization
  app.post('/api/organizations/:organizationId/members', isAuthenticated, async (req: any, res) => {
    const userId = req.authenticatedUserId;
    const { organizationId } = req.params;
    const { newUserId, role } = req.body;

    try {
      // Check if requester is org admin
      const isAdmin = await organizationService.isOrgAdmin(organizationId, userId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only org admins can add members' });
      }

      const member = await organizationService.addMember(organizationId, newUserId, role);

      await auditService.log({
        workspaceId: 'platform',
        userId,
        action: 'organization.member_added',
        resourceType: 'organization',
        resourceId: organizationId,
        changesAfter: { newUserId, role },
        status: 'success',
      });

      res.json(member);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Link workspace to organization
  app.post('/api/organizations/:organizationId/workspaces', isAuthenticated, async (req: any, res) => {
    const userId = req.authenticatedUserId;
    const { organizationId } = req.params;
    const { workspaceId } = req.body;

    try {
      const isAdmin = await organizationService.isOrgAdmin(organizationId, userId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only org admins can link workspaces' });
      }

      const link = await organizationService.linkWorkspace(organizationId, workspaceId);
      res.json(link);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update organization billing
  app.patch('/api/organizations/:organizationId/billing', isAuthenticated, async (req: any, res) => {
    const userId = req.authenticatedUserId;
    const { organizationId } = req.params;
    const { planType, monthlyBudget } = req.body;

    try {
      const isAdmin = await organizationService.isOrgAdmin(organizationId, userId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only org admins can update billing' });
      }

      await organizationService.updateOrgBilling(organizationId, planType, monthlyBudget);

      await auditService.log({
        workspaceId: 'platform',
        userId,
        action: 'organization.billing_updated',
        resourceType: 'organization',
        resourceId: organizationId,
        changesAfter: { planType, monthlyBudget },
        status: 'success',
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
