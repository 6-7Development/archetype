/**
 * Code Indexer - AST-based code intelligence for smarter context retrieval
 * 
 * Parses JavaScript/TypeScript files to extract:
 * - Imports and exports
 * - Functions and classes with line numbers
 * - Type definitions
 * - Dependency graphs
 * 
 * This enables:
 * - Automatic related file detection
 * - Smart chunking (extract only relevant functions)
 * - Better code search
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import * as crypto from 'crypto';
import { db } from '../db';
import { fileIndex, type InsertFileIndex } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface ParsedFile {
  filePath: string;
  language: string;
  imports: Array<{
    path: string;
    specifiers: string[];
    line: number;
  }>;
  exports: Array<{
    name: string;
    type: 'function' | 'class' | 'const' | 'type' | 'interface';
    line: number;
  }>;
  functions: Array<{
    name: string;
    params: string[];
    startLine: number;
    endLine: number;
    async: boolean;
  }>;
  classes: Array<{
    name: string;
    methods: string[];
    startLine: number;
    endLine: number;
  }>;
  types: Array<{
    name: string;
    kind: 'interface' | 'type' | 'enum';
    line: number;
  }>;
  complexity: number;
  linesOfCode: number;
  contentHash: string;
}

export class CodeIndexer {
  /**
   * Parse a TypeScript/JavaScript file and extract metadata
   */
  static async parseFile(filePath: string, content: string, projectId: string | null = null): Promise<ParsedFile> {
    const language = this.detectLanguage(filePath);
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');
    
    const parsed: ParsedFile = {
      filePath,
      language,
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      types: [],
      complexity: 0,
      linesOfCode: content.split('\n').length,
      contentHash,
    };

    try {
      // Parse file with Babel
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'dynamicImport',
        ],
      });

      // Traverse AST to extract metadata
      traverse(ast, {
        // Extract imports
        ImportDeclaration(path) {
          const importPath = path.node.source.value;
          const specifiers = path.node.specifiers.map(spec => {
            if (t.isImportDefaultSpecifier(spec)) return spec.local.name;
            if (t.isImportNamespaceSpecifier(spec)) return `* as ${spec.local.name}`;
            if (t.isImportSpecifier(spec)) {
              const imported = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
              return imported === spec.local.name ? imported : `${imported} as ${spec.local.name}`;
            }
            return '';
          }).filter(Boolean);

          parsed.imports.push({
            path: importPath,
            specifiers,
            line: path.node.loc?.start.line || 0,
          });
        },

        // Extract exports
        ExportNamedDeclaration(path) {
          if (path.node.declaration) {
            if (t.isFunctionDeclaration(path.node.declaration)) {
              const name = path.node.declaration.id?.name || 'anonymous';
              parsed.exports.push({
                name,
                type: 'function',
                line: path.node.loc?.start.line || 0,
              });
            } else if (t.isClassDeclaration(path.node.declaration)) {
              const name = path.node.declaration.id?.name || 'anonymous';
              parsed.exports.push({
                name,
                type: 'class',
                line: path.node.loc?.start.line || 0,
              });
            } else if (t.isVariableDeclaration(path.node.declaration)) {
              path.node.declaration.declarations.forEach(decl => {
                if (t.isIdentifier(decl.id)) {
                  parsed.exports.push({
                    name: decl.id.name,
                    type: 'const',
                    line: path.node.loc?.start.line || 0,
                  });
                }
              });
            } else if (t.isTSInterfaceDeclaration(path.node.declaration)) {
              parsed.exports.push({
                name: path.node.declaration.id.name,
                type: 'interface',
                line: path.node.loc?.start.line || 0,
              });
            } else if (t.isTSTypeAliasDeclaration(path.node.declaration)) {
              parsed.exports.push({
                name: path.node.declaration.id.name,
                type: 'type',
                line: path.node.loc?.start.line || 0,
              });
            }
          }
        },

        ExportDefaultDeclaration(path) {
          let name = 'default';
          if (t.isIdentifier(path.node.declaration)) {
            name = path.node.declaration.name;
          } else if (t.isFunctionDeclaration(path.node.declaration)) {
            name = path.node.declaration.id?.name || 'default';
          } else if (t.isClassDeclaration(path.node.declaration)) {
            name = path.node.declaration.id?.name || 'default';
          }
          
          parsed.exports.push({
            name,
            type: 'const',
            line: path.node.loc?.start.line || 0,
          });
        },

        // Extract functions
        FunctionDeclaration(path) {
          const name = path.node.id?.name || 'anonymous';
          const params = path.node.params.map(param => {
            if (t.isIdentifier(param)) return param.name;
            if (t.isRestElement(param) && t.isIdentifier(param.argument)) return `...${param.argument.name}`;
            return 'param';
          });
          
          parsed.functions.push({
            name,
            params,
            startLine: path.node.loc?.start.line || 0,
            endLine: path.node.loc?.end.line || 0,
            async: path.node.async || false,
          });
          
          // Calculate cyclomatic complexity (simplified)
          parsed.complexity += this.calculateComplexity(path);
        },

        // Extract arrow functions assigned to variables
        VariableDeclarator(path) {
          if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
            const name = t.isIdentifier(path.node.id) ? path.node.id.name : 'anonymous';
            const funcNode = path.node.init;
            const params = funcNode.params.map(param => {
              if (t.isIdentifier(param)) return param.name;
              if (t.isRestElement(param) && t.isIdentifier(param.argument)) return `...${param.argument.name}`;
              return 'param';
            });
            
            parsed.functions.push({
              name,
              params,
              startLine: path.node.loc?.start.line || 0,
              endLine: path.node.loc?.end.line || 0,
              async: funcNode.async || false,
            });
          }
        },

        // Extract classes
        ClassDeclaration(path) {
          const name = path.node.id?.name || 'anonymous';
          const methods = path.node.body.body
            .filter(member => t.isClassMethod(member))
            .map(member => {
              if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
                return member.key.name;
              }
              return '';
            })
            .filter(Boolean);

          parsed.classes.push({
            name,
            methods,
            startLine: path.node.loc?.start.line || 0,
            endLine: path.node.loc?.end.line || 0,
          });
        },

        // Extract TypeScript types and interfaces
        TSInterfaceDeclaration(path) {
          parsed.types.push({
            name: path.node.id.name,
            kind: 'interface',
            line: path.node.loc?.start.line || 0,
          });
        },

        TSTypeAliasDeclaration(path) {
          parsed.types.push({
            name: path.node.id.name,
            kind: 'type',
            line: path.node.loc?.start.line || 0,
          });
        },

        TSEnumDeclaration(path) {
          parsed.types.push({
            name: path.node.id.name,
            kind: 'enum',
            line: path.node.loc?.start.line || 0,
          });
        },
      });
    } catch (error: any) {
      console.warn(`[CODE-INDEXER] Failed to parse ${filePath}:`, error.message);
      // Return partial results even if parsing fails
    }

    return parsed;
  }

  /**
   * Calculate cyclomatic complexity (simplified)
   */
  private static calculateComplexity(path: any): number {
    let complexity = 1; // Base complexity

    // Count decision points
    traverse(path.node, {
      IfStatement: () => complexity++,
      ConditionalExpression: () => complexity++,
      LogicalExpression: (innerPath: any) => {
        if (innerPath.node.operator === '&&' || innerPath.node.operator === '||') {
          complexity++;
        }
      },
      SwitchCase: () => complexity++,
      ForStatement: () => complexity++,
      WhileStatement: () => complexity++,
      DoWhileStatement: () => complexity++,
      CatchClause: () => complexity++,
    }, path.scope);

    return complexity;
  }

  /**
   * Detect language from file extension
   */
  private static detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext === 'ts' || ext === 'tsx') return 'typescript';
    if (ext === 'js' || ext === 'jsx') return 'javascript';
    if (ext === 'py') return 'python';
    return 'unknown';
  }

  /**
   * Index a file and save to database
   */
  static async indexFile(filePath: string, content: string, projectId: string | null = null): Promise<void> {
    try {
      const parsed = await this.parseFile(filePath, content, projectId);

      // Calculate dependencies from imports
      const dependencies = parsed.imports.map(imp => imp.path);

      // Check if file already indexed
      const existing = await db.select()
        .from(fileIndex)
        .where(
          and(
            eq(fileIndex.filePath, filePath),
            projectId ? eq(fileIndex.projectId, projectId) : sql`project_id IS NULL`
          )
        )
        .limit(1);

      const indexData: InsertFileIndex = {
        projectId,
        filePath,
        language: parsed.language,
        imports: parsed.imports,
        exports: parsed.exports,
        functions: parsed.functions,
        classes: parsed.classes,
        types: parsed.types,
        importedBy: [], // Will be updated when dependent files are indexed
        dependencies,
        complexity: parsed.complexity,
        linesOfCode: parsed.linesOfCode,
        contentHash: parsed.contentHash,
      };

      if (existing.length > 0) {
        // Update existing index
        await db.update(fileIndex)
          .set({ ...indexData, updatedAt: new Date() })
          .where(eq(fileIndex.id, existing[0].id));
      } else {
        // Insert new index
        await db.insert(fileIndex).values(indexData);
      }

      console.log(`[CODE-INDEXER] Indexed ${filePath}: ${parsed.functions.length} functions, ${parsed.classes.length} classes`);
    } catch (error: any) {
      console.error(`[CODE-INDEXER] Failed to index ${filePath}:`, error.message);
    }
  }

  /**
   * Update dependency graph for all indexed files
   * This populates the importedBy field
   */
  static async updateDependencyGraph(projectId: string | null = null): Promise<void> {
    try {
      // Get all indexed files
      const files = await db.select()
        .from(fileIndex)
        .where(projectId ? eq(fileIndex.projectId, projectId) : sql`project_id IS NULL`);

      // Build reverse dependency map
      const reverseMap: Map<string, string[]> = new Map();

      for (const file of files) {
        for (const depPath of file.dependencies as string[]) {
          if (!reverseMap.has(depPath)) {
            reverseMap.set(depPath, []);
          }
          reverseMap.get(depPath)!.push(file.filePath);
        }
      }

      // Update importedBy for each file
      for (const file of files) {
        const importedBy = reverseMap.get(file.filePath) || [];
        await db.update(fileIndex)
          .set({ importedBy, updatedAt: new Date() })
          .where(eq(fileIndex.id, file.id));
      }

      console.log(`[CODE-INDEXER] Updated dependency graph for ${files.length} files`);
    } catch (error: any) {
      console.error(`[CODE-INDEXER] Failed to update dependency graph:`, error.message);
    }
  }
}
