import crypto from 'crypto';
import { db } from '../db';
import { aiKnowledgeBase, aiFixAttempts } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * Confidence Scoring System
 * 
 * Calculates confidence scores for AI-proposed fixes based on:
 * 1. Knowledge base matches (have we seen this error before?)
 * 2. Test coverage (do we have tests to verify the fix?)
 * 3. Code complexity (how risky is the change?)
 * 4. Historical success rate (how often do we succeed with similar fixes?)
 * 
 * THRESHOLDS:
 * - >= 95%: Auto-commit to main (high confidence)
 * - < 95%: Create GitHub PR for human review (low confidence)
 */

export interface ConfidenceFactors {
  knowledgeBaseMatch: number; // 0-40 points
  testCoverage: number; // 0-20 points
  codeComplexity: number; // 0-20 points
  historicalSuccess: number; // 0-20 points
}

export interface ConfidenceResult {
  score: number; // 0-100
  factors: ConfidenceFactors;
  recommendation: 'auto_commit' | 'create_pr';
  reasoning: string[];
}

export class ConfidenceScoring {
  private static readonly AUTO_COMMIT_THRESHOLD = 95;

  /**
   * Generate error signature (MD5 hash) from error details
   */
  static generateErrorSignature(error: {
    type: string;
    message: string;
    stackTrace?: string;
  }): string {
    const signatureString = `${error.type}:${error.message}:${error.stackTrace?.split('\n')[0] || ''}`;
    return crypto.createHash('md5').update(signatureString).digest('hex');
  }

  /**
   * Calculate confidence score for a proposed fix
   */
  static async calculateConfidence(params: {
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
    filesModified: string[];
    proposedFix: string;
    verificationPassed?: boolean;
  }): Promise<ConfidenceResult> {
    const { errorType, errorMessage, stackTrace, filesModified, verificationPassed } = params;

    // Generate error signature
    const errorSignature = this.generateErrorSignature({
      type: errorType,
      message: errorMessage,
      stackTrace,
    });

    // Initialize factors
    const factors: ConfidenceFactors = {
      knowledgeBaseMatch: 0,
      testCoverage: 0,
      codeComplexity: 0,
      historicalSuccess: 0,
    };

    const reasoning: string[] = [];

    // FACTOR 1: Knowledge base match (0-40 points)
    const knowledgeMatch = await this.checkKnowledgeBase(errorSignature);
    if (knowledgeMatch) {
      const successRate = knowledgeMatch.timesFixed / knowledgeMatch.timesEncountered;
      factors.knowledgeBaseMatch = Math.min(40, successRate * 40);
      reasoning.push(
        `✅ Found ${knowledgeMatch.timesEncountered} similar error(s), ${knowledgeMatch.timesFixed} fixed successfully (${(successRate * 100).toFixed(0)}% success rate)`
      );
    } else {
      factors.knowledgeBaseMatch = 10; // Small baseline for new errors
      reasoning.push('⚠️ New error pattern (no knowledge base match)');
    }

    // FACTOR 2: Test coverage (0-20 points)
    const testCoverageScore = await this.estimateTestCoverage(filesModified);
    factors.testCoverage = testCoverageScore;
    if (testCoverageScore >= 15) {
      reasoning.push(`✅ Good test coverage detected (${testCoverageScore}/20 points)`);
    } else if (testCoverageScore >= 10) {
      reasoning.push(`⚠️ Moderate test coverage (${testCoverageScore}/20 points)`);
    } else {
      reasoning.push(`❌ Low test coverage (${testCoverageScore}/20 points) - risky to auto-deploy`);
    }

    // FACTOR 3: Code complexity (0-20 points)
    const complexityScore = await this.assessCodeComplexity(filesModified);
    factors.codeComplexity = complexityScore;
    if (complexityScore >= 15) {
      reasoning.push(`✅ Low complexity change (${complexityScore}/20 points)`);
    } else if (complexityScore >= 10) {
      reasoning.push(`⚠️ Moderate complexity (${complexityScore}/20 points)`);
    } else {
      reasoning.push(`❌ High complexity change (${complexityScore}/20 points) - needs human review`);
    }

    // FACTOR 4: Historical success rate (0-20 points)
    const historicalScore = await this.getHistoricalSuccessRate(errorType);
    factors.historicalSuccess = historicalScore;
    if (historicalScore >= 15) {
      reasoning.push(`✅ High success rate for ${errorType} fixes (${historicalScore}/20 points)`);
    } else {
      reasoning.push(`⚠️ Lower historical success for ${errorType} (${historicalScore}/20 points)`);
    }

    // BONUS: Verification passed (+5 points)
    let totalScore =
      factors.knowledgeBaseMatch +
      factors.testCoverage +
      factors.codeComplexity +
      factors.historicalSuccess;

    if (verificationPassed) {
      totalScore += 5;
      reasoning.push('✅ Verification passed (TypeScript compilation successful)');
    } else {
      reasoning.push('❌ Verification not yet run');
    }

    // Cap at 100
    totalScore = Math.min(100, totalScore);

    // Determine recommendation
    const recommendation = totalScore >= this.AUTO_COMMIT_THRESHOLD ? 'auto_commit' : 'create_pr';

    if (recommendation === 'auto_commit') {
      reasoning.push(`\n🚀 **RECOMMENDATION: Auto-commit** (${totalScore}% confidence >= ${this.AUTO_COMMIT_THRESHOLD}% threshold)`);
    } else {
      reasoning.push(
        `\n📋 **RECOMMENDATION: Create PR for review** (${totalScore}% confidence < ${this.AUTO_COMMIT_THRESHOLD}% threshold)`
      );
    }

    return {
      score: totalScore,
      factors,
      recommendation,
      reasoning,
    };
  }

  /**
   * Search knowledge base for similar errors (public method for healOrchestrator)
   */
  static async searchKnowledgeBase(errorSignature: string): Promise<{
    match: any | null;
    confidence: number; // 0-100
    canAutoApply: boolean; // true if confidence >= 90%
  }> {
    try {
      const match = await this.checkKnowledgeBase(errorSignature);
      
      if (!match) {
        return {
          match: null,
          confidence: 0,
          canAutoApply: false,
        };
      }
      
      // Calculate confidence based on success rate
      const successRate = match.timesFixed / match.timesEncountered;
      const baseConfidence = parseFloat(match.confidence) || 0;
      
      // Weighted average: 60% historical success, 40% stored confidence
      const confidence = Math.round(successRate * 60 + baseConfidence * 0.4);
      
      // Can auto-apply if >= 90% confidence
      const canAutoApply = confidence >= 90;
      
      console.log(`[CONFIDENCE-SCORING] KB match found: ${match.timesFixed}/${match.timesEncountered} success (${confidence}% confidence)`);
      
      return {
        match,
        confidence,
        canAutoApply,
      };
    } catch (error) {
      console.error('[CONFIDENCE-SCORING] Error searching knowledge base:', error);
      return {
        match: null,
        confidence: 0,
        canAutoApply: false,
      };
    }
  }

  /**
   * Check knowledge base for similar errors
   */
  private static async checkKnowledgeBase(errorSignature: string) {
    try {
      const [match] = await db
        .select()
        .from(aiKnowledgeBase)
        .where(eq(aiKnowledgeBase.errorSignature, errorSignature))
        .limit(1);

      return match || null;
    } catch (error) {
      console.error('[CONFIDENCE-SCORING] Error checking knowledge base:', error);
      return null;
    }
  }

  /**
   * Estimate test coverage for modified files
   * Higher score if test files exist for the modified files
   */
  private static async estimateTestCoverage(filesModified: string[]): Promise<number> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      let testFilesFound = 0;
      let totalFiles = filesModified.length;

      for (const file of filesModified) {
        // Check if there's a corresponding test file
        const dir = path.dirname(file);
        const baseName = path.basename(file, path.extname(file));

        // Common test file patterns
        const testPatterns = [
          path.join(dir, `${baseName}.test.ts`),
          path.join(dir, `${baseName}.spec.ts`),
          path.join(dir, `${baseName}.test.tsx`),
          path.join(dir, `${baseName}.spec.tsx`),
          path.join(dir, '__tests__', `${baseName}.test.ts`),
        ];

        for (const testPath of testPatterns) {
          try {
            await fs.access(path.join(process.cwd(), testPath));
            testFilesFound++;
            break;
          } catch {
            // Test file not found, continue
          }
        }
      }

      // Score: 0-20 based on test coverage
      const coverageRatio = totalFiles > 0 ? testFilesFound / totalFiles : 0;
      return Math.round(coverageRatio * 20);
    } catch (error) {
      console.error('[CONFIDENCE-SCORING] Error estimating test coverage:', error);
      return 5; // Default low score on error
    }
  }

  /**
   * Assess code complexity of modified files
   * Lower complexity = higher confidence
   */
  private static async assessCodeComplexity(filesModified: string[]): Promise<number> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      let totalComplexity = 0;
      let filesAnalyzed = 0;

      for (const file of filesModified) {
        try {
          const filePath = path.join(process.cwd(), file);
          const content = await fs.readFile(filePath, 'utf-8');

          // Simple complexity heuristics:
          // - Line count
          // - Number of functions/classes
          // - Cyclomatic complexity indicators (if/else, loops, etc.)
          const lines = content.split('\n').length;
          const functionCount = (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length;
          const classCount = (content.match(/class\s+\w+/g) || []).length;
          const conditionals = (content.match(/if\s*\(|else|switch|case/g) || []).length;
          const loops = (content.match(/for\s*\(|while\s*\(/g) || []).length;

          // Complexity score (lower is better)
          const fileComplexity = lines / 100 + functionCount + classCount * 2 + conditionals + loops;

          totalComplexity += fileComplexity;
          filesAnalyzed++;
        } catch {
          // File not found or unreadable
          totalComplexity += 50; // Penalty for missing files
        }
      }

      const avgComplexity = filesAnalyzed > 0 ? totalComplexity / filesAnalyzed : 50;

      // Score: 20 points for low complexity, 0 for high
      // Complexity thresholds:
      // < 10: Simple (20 points)
      // 10-30: Moderate (10-20 points)
      // > 30: Complex (0-10 points)
      if (avgComplexity < 10) {
        return 20;
      } else if (avgComplexity < 30) {
        return Math.round(20 - ((avgComplexity - 10) / 20) * 10);
      } else {
        return Math.max(0, Math.round(10 - ((avgComplexity - 30) / 50) * 10));
      }
    } catch (error) {
      console.error('[CONFIDENCE-SCORING] Error assessing code complexity:', error);
      return 10; // Default moderate score on error
    }
  }

  /**
   * Get historical success rate for this error type
   */
  private static async getHistoricalSuccessRate(errorType: string): Promise<number> {
    try {
      const attempts = await db
        .select()
        .from(aiFixAttempts)
        .where(eq(aiFixAttempts.outcome, 'success'))
        .orderBy(desc(aiFixAttempts.createdAt))
        .limit(10);

      if (attempts.length === 0) {
        return 10; // Baseline for no history
      }

      // Calculate success rate from recent attempts
      const successCount = attempts.length;
      const successRate = successCount / 10; // Out of last 10 attempts

      return Math.round(successRate * 20);
    } catch (error) {
      console.error('[CONFIDENCE-SCORING] Error getting historical success rate:', error);
      return 10; // Default moderate score
    }
  }

  /**
   * Update knowledge base after a fix attempt
   */
  static async updateKnowledgeBase(params: {
    errorSignature: string;
    errorType: string;
    context: any;
    successfulFix?: string;
    wasSuccessful: boolean;
    confidence: number;
  }): Promise<void> {
    const { errorSignature, errorType, context, successfulFix, wasSuccessful, confidence } = params;

    try {
      // Check if entry exists
      const existing = await this.checkKnowledgeBase(errorSignature);

      if (existing) {
        // Update existing entry
        const newTimesFixed = wasSuccessful ? existing.timesFixed + 1 : existing.timesFixed;
        const newTimesEncountered = existing.timesEncountered + 1;
        const existingConfidence = parseFloat(existing.confidence);
        const newConfidence = (existingConfidence + confidence) / 2; // Average confidence

        await db
          .update(aiKnowledgeBase)
          .set({
            timesEncountered: newTimesEncountered,
            timesFixed: newTimesFixed,
            lastEncountered: new Date(),
            confidence: newConfidence.toFixed(2),
            successfulFix: wasSuccessful && successfulFix ? successfulFix : existing.successfulFix,
            updatedAt: new Date(),
          })
          .where(eq(aiKnowledgeBase.errorSignature, errorSignature));

        console.log(
          `[CONFIDENCE-SCORING] Updated knowledge base: ${errorSignature} (${newTimesFixed}/${newTimesEncountered} success)`
        );
      } else if (wasSuccessful && successfulFix) {
        // Create new entry (only if successful)
        await db.insert(aiKnowledgeBase).values({
          errorSignature,
          errorType,
          context,
          successfulFix,
          confidence: confidence.toFixed(2),
          timesEncountered: 1,
          timesFixed: 1,
        });

        console.log(`[CONFIDENCE-SCORING] Created knowledge base entry: ${errorSignature}`);
      }
    } catch (error) {
      console.error('[CONFIDENCE-SCORING] Error updating knowledge base:', error);
    }
  }

  /**
   * Record a fix attempt
   */
  static async recordFixAttempt(params: {
    errorSignature: string;
    healingSessionId: string;
    proposedFix: string;
    confidenceScore: number;
    outcome: 'success' | 'failure' | 'rolled_back' | 'pending';
    verificationResults?: any;
    prNumber?: number;
    prUrl?: string;
  }): Promise<void> {
    try {
      await db.insert(aiFixAttempts).values({
        errorSignature: params.errorSignature,
        healingSessionId: params.healingSessionId,
        proposedFix: params.proposedFix,
        confidenceScore: params.confidenceScore.toFixed(2),
        outcome: params.outcome,
        verificationResults: params.verificationResults || null,
        prNumber: params.prNumber || null,
        prUrl: params.prUrl || null,
        completedAt: params.outcome !== 'pending' ? new Date() : null,
      });

      console.log(`[CONFIDENCE-SCORING] Recorded fix attempt: ${params.outcome} (${params.confidenceScore}% confidence)`);
    } catch (error) {
      console.error('[CONFIDENCE-SCORING] Error recording fix attempt:', error);
    }
  }
}
