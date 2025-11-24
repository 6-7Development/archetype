/**
 * Gap #4: Architect Guidance Versioning
 * Tracks v1 vs v2 guidance, diffs, and enables rollback
 */

import { db } from './database';
import { architectConsultations } from '@shared/schema';

export interface ConsultationVersion {
  id: string;
  version: number;
  guidance: string;
  recommendations: string[];
  timestamp: number;
  status: 'applied' | 'rejected' | 'pending';
  changesSummary: string;
}

export interface VersionComparison {
  v1: ConsultationVersion;
  v2: ConsultationVersion;
  added: string[]; // New recommendations in v2
  removed: string[]; // Removed in v2
  modified: string[]; // Changed in v2
}

/**
 * Compare two consultation versions
 */
export function compareVersions(
  v1: ConsultationVersion,
  v2: ConsultationVersion,
): VersionComparison {
  const v1Set = new Set(v1.recommendations);
  const v2Set = new Set(v2.recommendations);

  const added = v2.recommendations.filter((r) => !v1Set.has(r));
  const removed = v1.recommendations.filter((r) => !v2Set.has(r));
  const modified = v1.recommendations.filter(
    (r) => v2Set.has(r) && v1.recommendations.indexOf(r) !== v2.recommendations.indexOf(r),
  );

  return {
    v1,
    v2,
    added,
    removed,
    modified,
  };
}

/**
 * Log version migration
 */
export function logVersionChange(comparison: VersionComparison) {
  console.log(`[ARCHITECT-VERSIONING] v${comparison.v1.version} → v${comparison.v2.version}`);
  console.log(`  Added: ${comparison.added.length} recommendations`);
  console.log(`  Removed: ${comparison.removed.length} recommendations`);
  console.log(`  Modified: ${comparison.modified.length} recommendations`);
}
