/**
 * File Relevance Detector - Auto-detect related files for context
 * 
 * When a user mentions a file or asks about code, this automatically includes:
 * - Files that import this file (dependents)
 * - Files imported by this file (dependencies)
 * - Test files for the component
 * - Related schema/type definitions
 * 
 * This gives BeeHiveAI better context without manual file specification
 */

import { db } from '../db';
import { fileIndex } from '@shared/schema';
import { eq, and, or, like, sql } from 'drizzle-orm';
import * as path from 'path';

export interface RelevantFile {
  filePath: string;
  reason: string;
  priority: number; // Higher = more relevant
}

export class FileRelevanceDetector {
  /**
   * Find all files relevant to the given file path
   */
  static async getRelevantFiles(
    filePath: string,
    projectId: string | null = null,
    maxFiles: number = 10
  ): Promise<RelevantFile[]> {
    const relevant: RelevantFile[] = [];

    try {
      // Get the target file's index data
      const [targetFile] = await db.select()
        .from(fileIndex)
        .where(
          and(
            eq(fileIndex.filePath, filePath),
            projectId ? eq(fileIndex.projectId, projectId) : sql`project_id IS NULL`
          )
        )
        .limit(1);

      if (!targetFile) {
        console.log(`[FILE-RELEVANCE] File not indexed: ${filePath}`);
        return [];
      }

      // 1. Direct dependencies (files this imports) - HIGH PRIORITY
      for (const depPath of targetFile.dependencies as string[]) {
        relevant.push({
          filePath: depPath,
          reason: `Imported by ${path.basename(filePath)}`,
          priority: 9,
        });
      }

      // 2. Direct dependents (files that import this) - HIGH PRIORITY
      for (const depPath of targetFile.importedBy as string[]) {
        relevant.push({
          filePath: depPath,
          reason: `Imports ${path.basename(filePath)}`,
          priority: 9,
        });
      }

      // 3. Test files for this component - VERY HIGH PRIORITY
      const testFiles = await this.findTestFiles(filePath, projectId);
      for (const testFile of testFiles) {
        relevant.push({
          filePath: testFile,
          reason: `Test file for ${path.basename(filePath)}`,
          priority: 10,
        });
      }

      // 4. Schema/type definition files - HIGH PRIORITY
      if (filePath.includes('component') || filePath.includes('page')) {
        const schemaFiles = await this.findSchemaFiles(filePath, projectId);
        for (const schemaFile of schemaFiles) {
          relevant.push({
            filePath: schemaFile,
            reason: `Schema/types for ${path.basename(filePath)}`,
            priority: 8,
          });
        }
      }

      // 5. Sibling files (same directory) - MEDIUM PRIORITY
      const siblingFiles = await this.findSiblingFiles(filePath, projectId);
      for (const siblingFile of siblingFiles) {
        if (siblingFile !== filePath) {
          relevant.push({
            filePath: siblingFile,
            reason: `Same directory as ${path.basename(filePath)}`,
            priority: 5,
          });
        }
      }

      // 6. Files with similar exports - MEDIUM PRIORITY
      if (targetFile.exports && (targetFile.exports as any[]).length > 0) {
        const similarFiles = await this.findFilesWithSimilarExports(
          targetFile.exports as any[],
          filePath,
          projectId
        );
        for (const similarFile of similarFiles) {
          relevant.push({
            filePath: similarFile,
            reason: `Similar exports to ${path.basename(filePath)}`,
            priority: 6,
          });
        }
      }

      // Deduplicate and sort by priority
      const uniqueFiles = new Map<string, RelevantFile>();
      for (const file of relevant) {
        if (!uniqueFiles.has(file.filePath) || uniqueFiles.get(file.filePath)!.priority < file.priority) {
          uniqueFiles.set(file.filePath, file);
        }
      }

      return Array.from(uniqueFiles.values())
        .sort((a, b) => b.priority - a.priority)
        .slice(0, maxFiles);
    } catch (error: any) {
      console.error(`[FILE-RELEVANCE] Error finding relevant files:`, error.message);
      return [];
    }
  }

  /**
   * Find test files for a given file
   */
  private static async findTestFiles(filePath: string, projectId: string | null): Promise<string[]> {
    const baseName = path.basename(filePath, path.extname(filePath));
    const dirName = path.dirname(filePath);

    // Common test file patterns
    const patterns = [
      `${baseName}.test.ts`,
      `${baseName}.test.tsx`,
      `${baseName}.test.js`,
      `${baseName}.spec.ts`,
      `${baseName}.spec.tsx`,
      `${baseName}.spec.js`,
      `__tests__/${baseName}.ts`,
      `__tests__/${baseName}.tsx`,
      `tests/${baseName}.ts`,
    ];

    const testFiles: string[] = [];

    for (const pattern of patterns) {
      const testPath = path.join(dirName, pattern);
      const results = await db.select()
        .from(fileIndex)
        .where(
          and(
            like(fileIndex.filePath, `%${pattern}`),
            projectId ? eq(fileIndex.projectId, projectId) : sql`project_id IS NULL`
          )
        )
        .limit(5);

      testFiles.push(...results.map(r => r.filePath));
    }

    return testFiles;
  }

  /**
   * Find schema/type definition files
   */
  private static async findSchemaFiles(filePath: string, projectId: string | null): Promise<string[]> {
    const patterns = ['schema.ts', 'types.ts', 'interfaces.ts', 'models.ts'];
    const dirName = path.dirname(filePath);

    const schemaFiles: string[] = [];

    for (const pattern of patterns) {
      const results = await db.select()
        .from(fileIndex)
        .where(
          and(
            or(
              like(fileIndex.filePath, `%${pattern}`),
              like(fileIndex.filePath, `${dirName}%${pattern}`)
            ),
            projectId ? eq(fileIndex.projectId, projectId) : sql`project_id IS NULL`
          )
        )
        .limit(3);

      schemaFiles.push(...results.map(r => r.filePath));
    }

    return schemaFiles;
  }

  /**
   * Find sibling files (same directory)
   */
  private static async findSiblingFiles(filePath: string, projectId: string | null): Promise<string[]> {
    const dirName = path.dirname(filePath);

    const siblings = await db.select()
      .from(fileIndex)
      .where(
        and(
          like(fileIndex.filePath, `${dirName}%`),
          projectId ? eq(fileIndex.projectId, projectId) : sql`project_id IS NULL`
        )
      )
      .limit(10);

    return siblings.map(s => s.filePath);
  }

  /**
   * Find files with similar exports (likely related components/utilities)
   */
  private static async findFilesWithSimilarExports(
    exports: any[],
    excludeFile: string,
    projectId: string | null
  ): Promise<string[]> {
    // Get all files in the project
    const allFiles = await db.select()
      .from(fileIndex)
      .where(projectId ? eq(fileIndex.projectId, projectId) : sql`project_id IS NULL`)
      .limit(100);

    // Score files by export similarity
    const scored = allFiles
      .filter(f => f.filePath !== excludeFile)
      .map(file => {
        const fileExports = (file.exports as any[]) || [];
        const exportNames = exports.map((e: any) => e.name);
        const fileExportNames = fileExports.map(e => e.name);

        // Count matching export names
        const matches = exportNames.filter(name => fileExportNames.includes(name)).length;

        return {
          filePath: file.filePath,
          score: matches,
        };
      })
      .filter(f => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return scored.map(f => f.filePath);
  }

  /**
   * Get all files mentioned in a user message
   * Extracts file paths from natural language
   */
  static extractFilePaths(message: string): string[] {
    const filePaths: string[] = [];

    // Pattern 1: Explicit file paths with extensions
    const explicitPattern = /(?:^|\s)([\w\/\-\.]+\.(ts|tsx|js|jsx|py|css|html|json))/gi;
    let match;
    while ((match = explicitPattern.exec(message)) !== null) {
      filePaths.push(match[1]);
    }

    // Pattern 2: Component names (converted to file paths)
    const componentPattern = /(?:component|file|in)\s+([\w\/\-]+)/gi;
    while ((match = componentPattern.exec(message)) !== null) {
      const name = match[1];
      // Try common patterns
      filePaths.push(`${name}.tsx`);
      filePaths.push(`${name}.ts`);
      filePaths.push(`client/src/components/${name}.tsx`);
      filePaths.push(`client/src/pages/${name}.tsx`);
    }

    return [...new Set(filePaths)]; // Deduplicate
  }

  /**
   * Get comprehensive context for a user request
   * Auto-detects relevant files and returns them
   */
  static async getContextForRequest(
    message: string,
    projectId: string | null = null,
    maxFiles: number = 15
  ): Promise<RelevantFile[]> {
    const allRelevant: RelevantFile[] = [];

    // Extract mentioned files from message
    const mentionedFiles = this.extractFilePaths(message);

    // For each mentioned file, get its relevant files
    for (const filePath of mentionedFiles) {
      const relevant = await this.getRelevantFiles(filePath, projectId, maxFiles);
      allRelevant.push(...relevant);
    }

    // Deduplicate and sort
    const uniqueFiles = new Map<string, RelevantFile>();
    for (const file of allRelevant) {
      if (!uniqueFiles.has(file.filePath) || uniqueFiles.get(file.filePath)!.priority < file.priority) {
        uniqueFiles.set(file.filePath, file);
      }
    }

    return Array.from(uniqueFiles.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxFiles);
  }
}
