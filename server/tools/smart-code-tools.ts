/**
 * Smart Code Tools - Intelligence-enhanced file reading and searching
 * 
 * These tools leverage CodeIndexer, FileRelevanceDetector, and SmartChunker
 * to provide BeeHive with much smarter context retrieval.
 */

import { CodeIndexer } from '../services/codeIndexer';
import { FileRelevanceDetector } from '../services/fileRelevanceDetector';
import { SmartChunker } from '../services/smartChunker';
import * as fs from 'fs/promises';
import * as path from 'path';

const PROJECT_ROOT = process.cwd();

/**
 * Resolve file path (handles both absolute and relative paths)
 */
function resolveFilePath(filePath: string): string {
  // If path is absolute, use as-is
  if (path.isAbsolute(filePath)) return filePath;
  
  // Otherwise join with PROJECT_ROOT
  return path.join(PROJECT_ROOT, filePath);
}

/**
 * Index a file for intelligent search
 * This parses the file with AST and stores metadata
 */
export async function indexFile(params: {
  filePath: string;
  projectId?: string | null;
}): Promise<string> {
  try {
    const { filePath, projectId = null } = params;
    
    // Resolve path
    const fullPath = resolveFilePath(filePath);
    
    // Read file content
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Index the file
    await CodeIndexer.indexFile(filePath, content, projectId);
    
    return `✅ Indexed ${filePath} successfully. File metadata extracted and stored for intelligent search.`;
  } catch (error: any) {
    return `❌ Failed to index file: ${error.message}`;
  }
}

/**
 * Smart file read - automatically detects what's relevant
 * Instead of reading entire files, this extracts only what's needed
 */
export async function smartReadFile(params: {
  filePath: string;
  context?: string;
  projectId?: string | null;
}): Promise<string> {
  try {
    const { filePath, context = '', projectId = null } = params;
    
    // Use SmartChunker to get relevant content based on context
    const content = await SmartChunker.smartRead(filePath, context, projectId);
    
    return content;
  } catch (error: any) {
    return `Error reading file: ${error.message}`;
  }
}

/**
 * Get related files for better context
 * Automatically includes dependencies, dependents, tests, schemas
 */
export async function getRelatedFiles(params: {
  filePath: string;
  projectId?: string | null;
  maxFiles?: number;
}): Promise<string> {
  try {
    const { filePath, projectId = null, maxFiles = 10 } = params;
    
    const relevant = await FileRelevanceDetector.getRelevantFiles(filePath, projectId, maxFiles);
    
    if (relevant.length === 0) {
      return `No related files found for ${filePath}. The file may not be indexed yet.`;
    }
    
    const output: string[] = [`Related files for ${filePath}:\n`];
    
    for (const file of relevant) {
      output.push(`  📄 ${file.filePath}`);
      output.push(`     Reason: ${file.reason}`);
      output.push(`     Priority: ${file.priority}/10`);
      output.push('');
    }
    
    return output.join('\n');
  } catch (error: any) {
    return `Error finding related files: ${error.message}`;
  }
}

/**
 * Extract specific function from a file
 * Token-efficient way to get only what you need
 */
export async function extractFunction(params: {
  filePath: string;
  functionName: string;
  includeContext?: boolean;
  projectId?: string | null;
}): Promise<string> {
  try {
    const { filePath, functionName, includeContext = true, projectId = null } = params;
    
    const chunk = await SmartChunker.extractFunction(filePath, functionName, projectId, includeContext);
    
    if (!chunk) {
      return `Function '${functionName}' not found in ${filePath}. Make sure the file is indexed.`;
    }
    
    let output = `// Function: ${functionName} (Lines ${chunk.startLine}-${chunk.endLine})\n`;
    
    if (chunk.context) {
      output += `\n// Context (imports):\n${chunk.context}\n`;
    }
    
    output += `\n${chunk.content}`;
    
    return output;
  } catch (error: any) {
    return `Error extracting function: ${error.message}`;
  }
}

/**
 * Get auto-context for a user request
 * Analyzes the message and automatically includes relevant files
 */
export async function getAutoContext(params: {
  message: string;
  projectId?: string | null;
  maxFiles?: number;
}): Promise<string> {
  try {
    const { message, projectId = null, maxFiles = 15 } = params;
    
    const relevant = await FileRelevanceDetector.getContextForRequest(message, projectId, maxFiles);
    
    if (relevant.length === 0) {
      return 'No specific files detected in request. You may want to manually specify files.';
    }
    
    const output: string[] = ['Auto-detected relevant context:\n'];
    
    for (const file of relevant) {
      output.push(`📄 ${file.filePath} (${file.reason}, priority: ${file.priority})`);
    }
    
    output.push('\nYou can now read these files for better context!');
    
    return output.join('\n');
  } catch (error: any) {
    return `Error getting auto-context: ${error.message}`;
  }
}

/**
 * Get file summary without reading entire file
 * Shows imports, exports, functions, classes - token-efficient!
 */
export async function getFileSummary(params: {
  filePath: string;
  projectId?: string | null;
}): Promise<string> {
  try {
    const { filePath, projectId = null } = params;
    
    const summary = await SmartChunker.getFileSummary(filePath, projectId);
    
    return summary;
  } catch (error: any) {
    return `Error getting file summary: ${error.message}`;
  }
}
