/**
 * VERSION MANAGER - GAP #2 & #4 FIX
 * Manages semantic versioning, releases, and version tracking
 * Supports development, staging, and production environments
 */

import { db } from '../db';
import { versionTracking, deploymentHistory } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

export class VersionManager {
  /**
   * Parse semver string to object
   */
  static parse(versionStr: string): SemanticVersion {
    const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)(?:-.*)?$/);
    if (!match) {
      throw new Error(`Invalid semver format: ${versionStr}`);
    }
    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3]),
    };
  }

  /**
   * Convert semver object to string
   */
  static toString(ver: SemanticVersion): string {
    return `${ver.major}.${ver.minor}.${ver.patch}`;
  }

  /**
   * Bump version by type
   */
  static bump(versionStr: string, type: 'major' | 'minor' | 'patch'): string {
    const ver = this.parse(versionStr);

    if (type === 'major') {
      ver.major++;
      ver.minor = 0;
      ver.patch = 0;
    } else if (type === 'minor') {
      ver.minor++;
      ver.patch = 0;
    } else if (type === 'patch') {
      ver.patch++;
    }

    return this.toString(ver);
  }

  /**
   * Get current version for environment
   */
  static async getCurrentVersion(environment: 'development' | 'staging' | 'production'): Promise<string | null> {
    try {
      const result = await db
        .select()
        .from(versionTracking)
        .where(eq(versionTracking.environment, environment))
        .limit(1);

      return result[0]?.currentVersion || null;
    } catch (error) {
      console.error('[VERSION-MANAGER] Error fetching version:', error);
      return null;
    }
  }

  /**
   * Update version for environment
   */
  static async updateVersion(
    environment: 'development' | 'staging' | 'production',
    newVersion: string,
    details: {
      releaseDate: string;
      changelog: string[];
      commitSha: string;
      features?: string[];
    },
    updatedBy: string
  ): Promise<void> {
    try {
      const current = await this.getCurrentVersion(environment);

      // Upsert version tracking
      if (current) {
        // Update existing
        await db
          .update(versionTracking)
          .set({
            previousVersion: current,
            currentVersion: newVersion,
            versionDetails: {
              ...details,
              features: details.features || [],
            },
            lastUpdated: new Date(),
            updatedBy,
          })
          .where(eq(versionTracking.environment, environment));
      } else {
        // Insert new
        await db.insert(versionTracking).values({
          environment,
          currentVersion: newVersion,
          previousVersion: null,
          versionDetails: {
            ...details,
            features: details.features || [],
          },
          updatedBy,
        });
      }

      console.log(`✅ [VERSION-MANAGER] Updated ${environment} to ${newVersion}`);
    } catch (error) {
      console.error('[VERSION-MANAGER] Error updating version:', error);
      throw error;
    }
  }

  /**
   * Log deployment attempt
   */
  static async logDeployment(
    version: string,
    environment: 'staging' | 'production',
    commitHash: string,
    branch: string,
    deployedBy: string,
    validationLog?: Record<string, any>
  ): Promise<number> {
    try {
      const result = await db
        .insert(deploymentHistory)
        .values({
          version,
          environment,
          branch,
          commitHash,
          deployedBy,
          status: 'pending',
          validationLog: validationLog || {},
        })
        .returning({ id: deploymentHistory.id });

      return result[0]?.id || 0;
    } catch (error) {
      console.error('[VERSION-MANAGER] Error logging deployment:', error);
      throw error;
    }
  }

  /**
   * Update deployment status
   */
  static async updateDeploymentStatus(
    deploymentId: number,
    status: 'success' | 'failed' | 'rolled_back',
    errorMessage?: string,
    metrics?: Record<string, any>
  ): Promise<void> {
    try {
      await db
        .update(deploymentHistory)
        .set({
          status,
          errorMessage: errorMessage || null,
          completedAt: new Date(),
          metrics: metrics || {},
        })
        .where(eq(deploymentHistory.id, deploymentId));

      console.log(`✅ [VERSION-MANAGER] Updated deployment ${deploymentId} to ${status}`);
    } catch (error) {
      console.error('[VERSION-MANAGER] Error updating deployment:', error);
      throw error;
    }
  }

  /**
   * Get deployment history
   */
  static async getDeploymentHistory(environment?: string, limit: number = 20) {
    try {
      let query = db.select().from(deploymentHistory);

      if (environment) {
        query = query.where(eq(deploymentHistory.environment, environment));
      }

      const results = await query.orderBy(deploymentHistory.deployedAt).limit(limit);
      return results;
    } catch (error) {
      console.error('[VERSION-MANAGER] Error fetching deployment history:', error);
      return [];
    }
  }

  /**
   * Validate deployment (check for errors)
   */
  static async validateDeployment(environment: string, lastMinutes: number = 5): Promise<{
    safe: boolean;
    errorCount: number;
    lastDeployment: any | null;
  }> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - lastMinutes * 60 * 1000);

      const results = await db
        .select()
        .from(deploymentHistory)
        .where(eq(deploymentHistory.environment, environment));

      const recentFailures = results.filter(
        (d) => d.status === 'failed' && d.deployedAt && d.deployedAt > fiveMinutesAgo
      );

      return {
        safe: recentFailures.length < 3,
        errorCount: recentFailures.length,
        lastDeployment: results[results.length - 1] || null,
      };
    } catch (error) {
      console.error('[VERSION-MANAGER] Error validating deployment:', error);
      return { safe: false, errorCount: 0, lastDeployment: null };
    }
  }
}

export const versionManager = new VersionManager();
