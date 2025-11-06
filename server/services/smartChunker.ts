/**
 * Smart Chunker - Extract only relevant code sections instead of entire files
 * 
 * Instead of reading a 2000-line file, this extracts:
 * - Specific functions by name
 * - Specific classes with their methods
 * - Type definitions
 * - Import/export blocks
 * 
 * This dramatically reduces token usage while maintaining context
 */

import { db } from '../db';
import { fileIndex } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import * as fs from 'fs/promises';

export interface CodeChunk {
  type: 'function' | 'class' | 'type' | 'import' | 'export' | 'full';
  name: string;
  content: string;
  startLine: number;
  endLine: number;
  context?: string; // Surrounding context if needed
}

export class SmartChunker {
  /**
   * Extract a specific function from a file
   */
  static async extractFunction(
    filePath: string,
    functionName: string,
    projectId: string | null = null,
    includeContext: boolean = false
  ): Promise<CodeChunk | null> {
    try {
      // Get file index data
      const [indexed] = await db.select()
        .from(fileIndex)
        .where(
          and(
            eq(fileIndex.filePath, filePath),
            projectId ? eq(fileIndex.projectId, projectId) : sql`project_id IS NULL`
          )
        )
        .limit(1);

      if (!indexed) {
        console.log(`[SMART-CHUNKER] File not indexed: ${filePath}`);
        return null;
      }

      // Find function in index
      const functions = (indexed.functions as any[]) || [];
      const targetFunc = functions.find(f => f.name === functionName);

      if (!targetFunc) {
        console.log(`[SMART-CHUNKER] Function not found: ${functionName} in ${filePath}`);
        return null;
      }

      // Read file content
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n');

      // Extract function lines
      const startLine = Math.max(0, targetFunc.startLine - 1);
      const endLine = Math.min(lines.length, targetFunc.endLine);
      const functionLines = lines.slice(startLine, endLine);

      // Add context if requested (imports + surrounding code)
      let context = '';
      if (includeContext) {
        // Get imports (first 20 lines usually contain imports)
        const importLines = lines.slice(0, Math.min(20, lines.length));
        context = importLines.join('\n') + '\n\n// ... (code omitted)\n\n';
      }

      return {
        type: 'function',
        name: functionName,
        content: functionLines.join('\n'),
        startLine: targetFunc.startLine,
        endLine: targetFunc.endLine,
        context: includeContext ? context : undefined,
      };
    } catch (error: any) {
      console.error(`[SMART-CHUNKER] Error extracting function:`, error.message);
      return null;
    }
  }

  /**
   * Extract a specific class from a file
   */
  static async extractClass(
    filePath: string,
    className: string,
    projectId: string | null = null,
    includeContext: boolean = false
  ): Promise<CodeChunk | null> {
    try {
      const [indexed] = await db.select()
        .from(fileIndex)
        .where(
          and(
            eq(fileIndex.filePath, filePath),
            projectId ? eq(fileIndex.projectId, projectId) : sql`project_id IS NULL`
          )
        )
        .limit(1);

      if (!indexed) return null;

      const classes = (indexed.classes as any[]) || [];
      const targetClass = classes.find(c => c.name === className);

      if (!targetClass) return null;

      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n');

      const startLine = Math.max(0, targetClass.startLine - 1);
      const endLine = Math.min(lines.length, targetClass.endLine);
      const classLines = lines.slice(startLine, endLine);

      let context = '';
      if (includeContext) {
        const importLines = lines.slice(0, Math.min(20, lines.length));
        context = importLines.join('\n') + '\n\n// ... (code omitted)\n\n';
      }

      return {
        type: 'class',
        name: className,
        content: classLines.join('\n'),
        startLine: targetClass.startLine,
        endLine: targetClass.endLine,
        context: includeContext ? context : undefined,
      };
    } catch (error: any) {
      console.error(`[SMART-CHUNKER] Error extracting class:`, error.message);
      return null;
    }
  }

  /**
   * Extract multiple functions from a file
   */
  static async extractFunctions(
    filePath: string,
    functionNames: string[],
    projectId: string | null = null
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    for (const name of functionNames) {
      const chunk = await this.extractFunction(filePath, name, projectId, true);
      if (chunk) chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Get import summary for a file (lightweight context)
   */
  static async getImportSummary(
    filePath: string,
    projectId: string | null = null
  ): Promise<string> {
    try {
      const [indexed] = await db.select()
        .from(fileIndex)
        .where(
          and(
            eq(fileIndex.filePath, filePath),
            projectId ? eq(fileIndex.projectId, projectId) : sql`project_id IS NULL`
          )
        )
        .limit(1);

      if (!indexed) return '';

      const imports = (indexed.imports as any[]) || [];
      const importLines = imports.map(imp => {
        const specs = imp.specifiers.join(', ');
        return `import { ${specs} } from '${imp.path}';`;
      });

      return importLines.join('\n');
    } catch (error: any) {
      return '';
    }
  }

  /**
   * Get export summary for a file
   */
  static async getExportSummary(
    filePath: string,
    projectId: string | null = null
  ): Promise<string> {
    try {
      const [indexed] = await db.select()
        .from(fileIndex)
        .where(
          and(
            eq(fileIndex.filePath, filePath),
            projectId ? eq(fileIndex.projectId, projectId) : sql`project_id IS NULL`
          )
        )
        .limit(1);

      if (!indexed) return '';

      const exports = (indexed.exports as any[]) || [];
      return exports.map(exp => `export ${exp.type} ${exp.name}`).join('\n');
    } catch (error: any) {
      return '';
    }
  }

  /**
   * Get a smart summary of a file (imports + exports + function signatures)
   * WITHOUT reading the full file - token-efficient!
   */
  static async getFileSummary(
    filePath: string,
    projectId: string | null = null
  ): Promise<string> {
    try {
      const [indexed] = await db.select()
        .from(fileIndex)
        .where(
          and(
            eq(fileIndex.filePath, filePath),
            projectId ? eq(fileIndex.projectId, projectId) : sql`project_id IS NULL`
          )
        )
        .limit(1);

      if (!indexed) return `File not indexed: ${filePath}`;

      const summary: string[] = [];
      summary.push(`// File: ${filePath}`);
      summary.push(`// Language: ${indexed.language}`);
      summary.push(`// Lines: ${indexed.linesOfCode}, Complexity: ${indexed.complexity}`);
      summary.push('');

      // Imports
      const imports = (indexed.imports as any[]) || [];
      if (imports.length > 0) {
        summary.push('// Imports:');
        imports.forEach(imp => {
          summary.push(`import { ${imp.specifiers.join(', ')} } from '${imp.path}';`);
        });
        summary.push('');
      }

      // Functions
      const functions = (indexed.functions as any[]) || [];
      if (functions.length > 0) {
        summary.push('// Functions:');
        functions.forEach(func => {
          const asyncStr = func.async ? 'async ' : '';
          summary.push(`${asyncStr}function ${func.name}(${func.params.join(', ')}) // Lines ${func.startLine}-${func.endLine}`);
        });
        summary.push('');
      }

      // Classes
      const classes = (indexed.classes as any[]) || [];
      if (classes.length > 0) {
        summary.push('// Classes:');
        classes.forEach(cls => {
          summary.push(`class ${cls.name} { // Lines ${cls.startLine}-${cls.endLine}`);
          summary.push(`  methods: ${cls.methods.join(', ')}`);
          summary.push('}');
        });
        summary.push('');
      }

      // Types
      const types = (indexed.types as any[]) || [];
      if (types.length > 0) {
        summary.push('// Types:');
        types.forEach(type => {
          summary.push(`${type.kind} ${type.name} // Line ${type.line}`);
        });
      }

      // Exports
      const exports = (indexed.exports as any[]) || [];
      if (exports.length > 0) {
        summary.push('');
        summary.push('// Exports:');
        exports.forEach(exp => {
          summary.push(`export ${exp.type} ${exp.name}`);
        });
      }

      return summary.join('\n');
    } catch (error: any) {
      return `Error getting summary: ${error.message}`;
    }
  }

  /**
   * Smart read: Get only what's needed based on context
   * 
   * If specific functions mentioned, extract those.
   * Otherwise, return a summary.
   */
  static async smartRead(
    filePath: string,
    context: string,
    projectId: string | null = null
  ): Promise<string> {
    // Extract mentioned function/class names from context
    const functionMatches = context.match(/(?:function|fix|update|change)\s+(\w+)/gi);
    const classMatches = context.match(/(?:class|component)\s+(\w+)/gi);

    const functionNames = functionMatches?.map(m => m.split(/\s+/).pop()!) || [];
    const classNames = classMatches?.map(m => m.split(/\s+/).pop()!) || [];

    if (functionNames.length > 0 || classNames.length > 0) {
      // Extract specific functions/classes
      const chunks: CodeChunk[] = [];

      for (const name of functionNames) {
        const chunk = await this.extractFunction(filePath, name, projectId, true);
        if (chunk) chunks.push(chunk);
      }

      for (const name of classNames) {
        const chunk = await this.extractClass(filePath, name, projectId, true);
        if (chunk) chunks.push(chunk);
      }

      if (chunks.length > 0) {
        return chunks.map(c => c.context + '\n' + c.content).join('\n\n// ...\n\n');
      }
    }

    // No specific items mentioned - return summary
    return this.getFileSummary(filePath, projectId);
  }
}
