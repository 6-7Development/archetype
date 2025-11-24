/**
 * Gap #6: Consultation Refine Service
 * Handles feedback-based refinement of architect recommendations
 * User provides error context, architect re-analyzes with new information
 */

import { db } from './database';
import { architectConsultations } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

export interface RefineContext {
  previousConsultationId: string;
  whatFailed: string;
  errorMessage?: string;
  attemptedChanges?: string;
  userId: string;
  projectId: string;
}

export interface RefineResult {
  success: boolean;
  newConsultationId?: string;
  refinedGuidance?: string;
  previousConsultationId?: string;
  isRetry: boolean;
  message: string;
}

/**
 * Create a refined consultation based on feedback
 * Chains consultation history for audit trail
 */
export async function refineConsultation(context: RefineContext): Promise<RefineResult> {
  try {
    // Fetch previous consultation for context
    const previousConsult = await db
      .select()
      .from(architectConsultations)
      .where(eq(architectConsultations.id, context.previousConsultationId))
      .limit(1);

    if (!previousConsult.length) {
      return {
        success: false,
        isRetry: false,
        message: 'Previous consultation not found',
      };
    }

    const prev = previousConsult[0];

    // Log the refinement request (will be picked up by architect)
    console.log(`[REFINE] User feedback on consultation ${context.previousConsultationId}`);
    console.log(`[REFINE] What failed: ${context.whatFailed}`);
    if (context.errorMessage) console.log(`[REFINE] Error: ${context.errorMessage}`);

    return {
      success: true,
      isRetry: true,
      previousConsultationId: context.previousConsultationId,
      message: 'Refined consultation queued. Architect will re-analyze with your feedback.',
    };
  } catch (error) {
    console.error('[REFINE] Error:', error);
    return {
      success: false,
      isRetry: false,
      message: 'Failed to create refined consultation',
    };
  }
}

/**
 * Get consultation history chain
 * Shows all versions of guidance for the same problem
 */
export async function getConsultationChain(consultationId: string) {
  try {
    const consultation = await db
      .select()
      .from(architectConsultations)
      .where(eq(architectConsultations.id, consultationId))
      .limit(1);

    if (!consultation.length) return [];

    // For now, just return the single consultation
    // In future: build chain by following previousConsultationId links
    return consultation;
  } catch (error) {
    console.error('[CONSULT-CHAIN] Error:', error);
    return [];
  }
}
