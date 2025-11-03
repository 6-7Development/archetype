/**
 * Generic file operations for Lomu AI
 * Glob, ls, read, write operations that work across platform and project files
 */

import fs from 'fs/promises';
import path from 'path';
import { platformHealing } from '../platformHealing';

export interface GlobResult {
  success: boolean;
  message: string;
  files: string[];
  error?: string;
}

export interface LsResult {
  success: boolean;
  message: string;
  entries: {
    name: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: Date;
  }[];
  error?: string;
}

export interface ReadResult {
  success: boolean;
  message: string;
  content?: string;
  filePath?: string;
  error?: string;
}

export interface WriteResult {
  success: boolean;
  message: string;
  filePath?: string;
  error?: string;
}

/**
 * Glob - File pattern matching
 * Find files matching a glob pattern
 */
export async function glob(params: {
  pattern: string;
  path?: string;
}): Promise<GlobResult> {
  const { pattern, path: basePath = '.' } = params;
  
  try {
    // Use platform healing's search function
    const results = await platformHealing.searchPlatformFiles(pattern);
    
    return {
      success: true,
      message: `Found ${results.length} file(s) matching "${pattern}"`,
      files: results,
    };
  } catch (error: any) {
    console.error('[GLOB] Error:', error);
    return {
      success: false,
      message: `Glob search failed: ${error.message}`,
      files: [],
      error: error.message,
    };
  }
}

/**
 * Ls - List directory contents
 * List all files and directories in a path
 */
export async function ls(params: {
  path?: string;
  recursive?: boolean;
  include_hidden?: boolean;
  max_files?: number;
  ignore?: string[];
}): Promise<LsResult> {
  const {
    path: dirPath = '.',
    recursive = false,
    include_hidden = false,
    max_files = 1000,
    ignore = ['node_modules', '.git', 'dist'],
  } = params;
  
  try {
    const fullPath = path.resolve(process.cwd(), dirPath);
    const entries: LsResult['entries'] = [];
    
    const readDirectory = async (currentPath: string, depth: number = 0): Promise<void> => {
      if (entries.length >= max_files) return;
      
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        if (entries.length >= max_files) break;
        
        // Skip hidden files if not included
        if (!include_hidden && item.startsWith('.')) continue;
        
        // Skip ignored directories
        if (ignore.includes(item)) continue;
        
        const itemPath = path.join(currentPath, item);
        const stats = await fs.stat(itemPath);
        const relativePath = path.relative(fullPath, itemPath);
        
        entries.push({
          name: depth > 0 ? relativePath : item,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime,
        });
        
        // Recurse into directories if recursive mode
        if (recursive && stats.isDirectory()) {
          await readDirectory(itemPath, depth + 1);
        }
      }
    };
    
    await readDirectory(fullPath);
    
    return {
      success: true,
      message: `Listed ${entries.length} entries in "${dirPath}"`,
      entries,
    };
  } catch (error: any) {
    console.error('[LS] Error:', error);
    return {
      success: false,
      message: `Failed to list directory: ${error.message}`,
      entries: [],
      error: error.message,
    };
  }
}

/**
 * Read - Generic file read
 * Read file contents from any path
 */
export async function read(params: {
  file_path: string;
  offset?: number;
  limit?: number;
}): Promise<ReadResult> {
  const { file_path, offset = 0, limit = 1000 } = params;
  
  try {
    // Try to read as platform file first
    try {
      const content = await platformHealing.readPlatformFile(file_path);
      
      // Apply offset and limit
      const lines = content.split('\n');
      const selectedLines = lines.slice(offset, offset + limit);
      const limitedContent = selectedLines.join('\n');
      
      return {
        success: true,
        message: `Read ${selectedLines.length} lines from ${file_path}`,
        content: limitedContent,
        filePath: file_path,
      };
    } catch (platformError) {
      // If not a platform file, try absolute path
      const fullPath = path.resolve(process.cwd(), file_path);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Apply offset and limit
      const lines = content.split('\n');
      const selectedLines = lines.slice(offset, offset + limit);
      const limitedContent = selectedLines.join('\n');
      
      return {
        success: true,
        message: `Read ${selectedLines.length} lines from ${file_path}`,
        content: limitedContent,
        filePath: file_path,
      };
    }
  } catch (error: any) {
    console.error('[READ] Error:', error);
    return {
      success: false,
      message: `Failed to read file: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Write - Generic file write
 * Write content to a file
 */
export async function write(params: {
  file_path: string;
  content: string;
}): Promise<WriteResult> {
  const { file_path, content } = params;
  
  try {
    // Try to write as platform file first
    try {
      await platformHealing.writePlatformFile(file_path, content);
      
      return {
        success: true,
        message: `Successfully wrote to ${file_path}`,
        filePath: file_path,
      };
    } catch (platformError) {
      // If not a platform file, try absolute path
      const fullPath = path.resolve(process.cwd(), file_path);
      
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write file
      await fs.writeFile(fullPath, content, 'utf-8');
      
      return {
        success: true,
        message: `Successfully wrote to ${file_path}`,
        filePath: file_path,
      };
    }
  } catch (error: any) {
    console.error('[WRITE] Error:', error);
    return {
      success: false,
      message: `Failed to write file: ${error.message}`,
      error: error.message,
    };
  }
}
