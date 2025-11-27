/**
 * ENTERPRISE PHASE 3: SSO Service
 * Manages SAML/OAuth2 authentication for enterprise workspaces
 */

import { db } from '../db';
import { ssoConfiguration } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class SsoService {
  /**
   * Get SSO config for workspace
   */
  static async getSsoConfig(workspaceId: string) {
    try {
      const result = await db
        .select()
        .from(ssoConfiguration)
        .where(eq(ssoConfiguration.workspaceId, workspaceId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('[SSO] Error fetching config:', error);
      return null;
    }
  }

  /**
   * Check if SSO is enabled for workspace
   */
  static async isSsoEnabled(workspaceId: string): Promise<boolean> {
    try {
      const config = await this.getSsoConfig(workspaceId);
      return config?.enabled || false;
    } catch {
      return false;
    }
  }

  /**
   * Configure SAML for workspace
   */
  static async configureSaml(
    workspaceId: string,
    config: {
      entryPoint: string;
      cert: string;
      issuer: string;
      identifierFormat?: string;
    }
  ) {
    try {
      const existing = await this.getSsoConfig(workspaceId);

      if (existing) {
        await db
          .update(ssoConfiguration)
          .set({
            provider: 'saml2',
            entryPoint: config.entryPoint,
            cert: config.cert,
            issuer: config.issuer,
            identifierFormat: config.identifierFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            enabled: true,
            updatedAt: new Date(),
          })
          .where(eq(ssoConfiguration.workspaceId, workspaceId));
      } else {
        await db.insert(ssoConfiguration).values({
          workspaceId,
          provider: 'saml2',
          entryPoint: config.entryPoint,
          cert: config.cert,
          issuer: config.issuer,
          identifierFormat: config.identifierFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          enabled: true,
        });
      }

      console.log(`✅ [SSO] SAML configured for workspace ${workspaceId}`);
      return true;
    } catch (error) {
      console.error('[SSO] Error configuring SAML:', error);
      return false;
    }
  }

  /**
   * Configure OAuth2 for workspace
   */
  static async configureOAuth2(
    workspaceId: string,
    config: {
      clientId: string;
      clientSecret: string;
      authUrl: string;
      tokenUrl: string;
      userinfoUrl: string;
    }
  ) {
    try {
      const existing = await this.getSsoConfig(workspaceId);

      if (existing) {
        await db
          .update(ssoConfiguration)
          .set({
            provider: 'oauth2',
            oauth2ClientId: config.clientId,
            oauth2ClientSecret: config.clientSecret,
            oauth2AuthUrl: config.authUrl,
            oauth2TokenUrl: config.tokenUrl,
            oauth2UserinfoUrl: config.userinfoUrl,
            enabled: true,
            updatedAt: new Date(),
          })
          .where(eq(ssoConfiguration.workspaceId, workspaceId));
      } else {
        await db.insert(ssoConfiguration).values({
          workspaceId,
          provider: 'oauth2',
          oauth2ClientId: config.clientId,
          oauth2ClientSecret: config.clientSecret,
          oauth2AuthUrl: config.authUrl,
          oauth2TokenUrl: config.tokenUrl,
          oauth2UserinfoUrl: config.userinfoUrl,
          enabled: true,
        });
      }

      console.log(`✅ [SSO] OAuth2 configured for workspace ${workspaceId}`);
      return true;
    } catch (error) {
      console.error('[SSO] Error configuring OAuth2:', error);
      return false;
    }
  }

  /**
   * Disable SSO for workspace
   */
  static async disableSso(workspaceId: string) {
    try {
      await db
        .update(ssoConfiguration)
        .set({
          enabled: false,
          updatedAt: new Date(),
        })
        .where(eq(ssoConfiguration.workspaceId, workspaceId));

      console.log(`✅ [SSO] Disabled for workspace ${workspaceId}`);
      return true;
    } catch (error) {
      console.error('[SSO] Error disabling SSO:', error);
      return false;
    }
  }
}

export const ssoService = new SsoService();
