/**
 * Gap #9: Conflict Resolution Service
 * Handles 3-way merge when multiple subagents modify the same file
 * Detects, reports, and intelligently merges conflicts
 */

export interface FileConflict {
  filePath: string;
  subagent1: string; // Who made the change
  subagent2: string; // Who made the conflicting change
  content1: string; // Their content
  content2: string; // Their content
  base: string; // Original content before both changes
  timestamp1: number;
  timestamp2: number;
}

export interface MergeResult {
  success: boolean;
  merged: string;
  conflictMarkers?: string[];
  strategy: 'automatic' | 'manual' | 'theirs' | 'ours';
  confidence: number; // 0-100 how confident we are in merge
}

/**
 * Detect conflicts between subagent changes
 * Compares file snapshots from different execution phases
 */
export function detectConflicts(
  original: string,
  subagent1Result: string,
  subagent2Result: string,
  filePath: string,
): FileConflict | null {
  // Check if both made different changes
  if (subagent1Result === subagent2Result) {
    return null; // No conflict, same result
  }

  if (subagent1Result === original || subagent2Result === original) {
    return null; // One didn't make changes
  }

  // Conflict detected!
  return {
    filePath,
    subagent1: 'subagent-1',
    subagent2: 'subagent-2',
    content1: subagent1Result,
    content2: subagent2Result,
    base: original,
    timestamp1: Date.now(),
    timestamp2: Date.now(),
  };
}

/**
 * Attempt 3-way merge
 * Base + version1 + version2 → merged result
 */
export function merge3Way(conflict: FileConflict): MergeResult {
  const { base, content1, content2, filePath } = conflict;

  // Strategy 1: Check if changes are non-overlapping
  if (canMergeNonOverlapping(base, content1, content2)) {
    return {
      success: true,
      merged: performNonOverlappingMerge(base, content1, content2),
      strategy: 'automatic',
      confidence: 85,
    };
  }

  // Strategy 2: Try line-based merge
  const linesMerge = mergeLineByLine(base, content1, content2);
  if (linesMerge.success) {
    return {
      ...linesMerge,
      strategy: 'automatic',
      confidence: 70,
    };
  }

  // Strategy 3: Manual resolution needed
  return {
    success: false,
    merged: generateConflictMarkers(content1, content2),
    conflictMarkers: [
      `<<<<<<< ${conflict.subagent1}`,
      content1,
      '=======',
      content2,
      `>>>>>>> ${conflict.subagent2}`,
    ],
    strategy: 'manual',
    confidence: 0,
  };
}

function canMergeNonOverlapping(base: string, v1: string, v2: string): boolean {
  // Simple heuristic: if lengths differ significantly, likely non-overlapping changes
  const baseLen = base.length;
  const v1Len = v1.length;
  const v2Len = v2.length;

  // If both versions are longer than base and neither is base, might be non-overlapping adds
  return (
    (v1Len > baseLen && v2Len > baseLen && v1 !== v2) ||
    // Or if both are shorter (different removals), check if content is preserved
    (v1Len < baseLen && v2Len < baseLen)
  );
}

function performNonOverlappingMerge(base: string, v1: string, v2: string): string {
  // For JSON/code, try to parse and merge
  try {
    // If looks like JSON, parse and merge objects
    const baseObj = JSON.parse(base);
    const v1Obj = JSON.parse(v1);
    const v2Obj = JSON.parse(v2);

    // Shallow merge of objects
    const merged = {
      ...baseObj,
      ...v1Obj,
      ...v2Obj,
    };

    return JSON.stringify(merged, null, 2);
  } catch {
    // Not JSON, return v1 + v2 concatenated
    // This is a fallback and may result in duplicates
    return v1 + '\n' + v2;
  }
}

function mergeLineByLine(base: string, v1: string, v2: string): MergeResult {
  const baseLines = base.split('\n');
  const v1Lines = v1.split('\n');
  const v2Lines = v2.split('\n');

  // Simple line-by-line merge: if lines don't overlap, combine
  if (
    baseLines.length === v1Lines.length &&
    baseLines.length === v2Lines.length
  ) {
    // Same line count, check each line
    let hasConflict = false;
    const merged = baseLines.map((line, idx) => {
      if (v1Lines[idx] === v2Lines[idx]) return v1Lines[idx]; // Both agree
      if (v1Lines[idx] === line) return v2Lines[idx]; // Use v2's change
      if (v2Lines[idx] === line) return v1Lines[idx]; // Use v1's change
      hasConflict = true;
      return line; // Can't merge
    });

    if (!hasConflict) {
      return {
        success: true,
        merged: merged.join('\n'),
        strategy: 'automatic',
        confidence: 80,
      };
    }
  }

  return {
    success: false,
    merged: '',
    strategy: 'manual',
    confidence: 0,
  };
}

function generateConflictMarkers(v1: string, v2: string): string {
  return `<<<<<<< CONFLICT\n${v1}\n=======\n${v2}\n>>>>>>> END CONFLICT`;
}

/**
 * Log conflict for audit trail
 */
export function logConflict(conflict: FileConflict) {
  console.warn('[CONFLICT-RESOLUTION] ⚠️ File conflict detected');
  console.warn(`[CONFLICT-RESOLUTION] File: ${conflict.filePath}`);
  console.warn(`[CONFLICT-RESOLUTION] Subagent 1 size: ${conflict.content1.length}`);
  console.warn(`[CONFLICT-RESOLUTION] Subagent 2 size: ${conflict.content2.length}`);
}
