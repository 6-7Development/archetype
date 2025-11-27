/**
 * ENTERPRISE PHASE 8: Organization Service
 * Multi-organization hierarchy with org-wide controls
 */

import { db } from '../db';
import { organizations, organizationMembers, organizationWorkspaces, teamWorkspaces } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class OrganizationService {
  /**
   * Create organization
   */
  static async createOrganization(data: { name: string; slug: string; ownerId: string; description?: string }) {
    try {
      const org = await db
        .insert(organizations)
        .values(data)
        .returning();

      // Add owner as admin member
      await db.insert(organizationMembers).values({
        organizationId: org[0].id,
        userId: data.ownerId,
        role: 'owner',
      });

      return org[0];
    } catch (error) {
      console.error('[ORG] Create failed:', error);
      return null;
    }
  }

  /**
   * Add member to organization
   */
  static async addMember(organizationId: string, userId: string, role: 'owner' | 'admin' | 'member') {
    try {
      const member = await db
        .insert(organizationMembers)
        .values({ organizationId, userId, role })
        .returning();
      return member[0];
    } catch (error) {
      console.error('[ORG] Add member failed:', error);
      return null;
    }
  }

  /**
   * Link workspace to organization
   */
  static async linkWorkspace(organizationId: string, workspaceId: string) {
    try {
      const link = await db
        .insert(organizationWorkspaces)
        .values({ organizationId, workspaceId })
        .returning();
      return link[0];
    } catch (error) {
      console.error('[ORG] Link workspace failed:', error);
      return null;
    }
  }

  /**
   * Get organization with all members and workspaces
   */
  static async getOrganizationFull(organizationId: string) {
    try {
      const org = await db.select().from(organizations).where(eq(organizations.id, organizationId));
      const members = await db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, organizationId));
      const workspaceLinks = await db.select().from(organizationWorkspaces).where(eq(organizationWorkspaces.organizationId, organizationId));

      const workspaces = await db
        .select()
        .from(teamWorkspaces)
        .where(eq(teamWorkspaces.id, workspaceLinks[0]?.workspaceId));

      return {
        org: org[0],
        members,
        workspaceLinks,
        workspaces,
      };
    } catch (error) {
      console.error('[ORG] Get full failed:', error);
      return null;
    }
  }

  /**
   * Get user's organizations
   */
  static async getUserOrganizations(userId: string) {
    try {
      const orgMembers = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId));

      const userOrgs = [];
      for (const member of orgMembers) {
        const org = await db.select().from(organizations).where(eq(organizations.id, member.organizationId));
        userOrgs.push({
          ...org[0],
          role: member.role,
        });
      }

      return userOrgs;
    } catch (error) {
      console.error('[ORG] Get user orgs failed:', error);
      return [];
    }
  }

  /**
   * Update organization plan/budget
   */
  static async updateOrgBilling(organizationId: string, planType: string, monthlyBudget?: number) {
    try {
      await db
        .update(organizations)
        .set({ planType, monthlyBudget: monthlyBudget?.toString() })
        .where(eq(organizations.id, organizationId));

      return { success: true };
    } catch (error) {
      console.error('[ORG] Update billing failed:', error);
      return { error: error instanceof Error ? error.message : 'Failed' };
    }
  }

  /**
   * Check if user has org admin role
   */
  static async isOrgAdmin(organizationId: string, userId: string): Promise<boolean> {
    try {
      const member = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, organizationId));

      return member.some((m) => m.userId === userId && (m.role === 'owner' || m.role === 'admin'));
    } catch {
      return false;
    }
  }
}

export const organizationService = new OrganizationService();
