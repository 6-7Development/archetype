/**
 * Project File Tools for SySop
 * These tools allow SySop to work on USER projects (not platform code)
 */

import { storage } from '../storage';
import type { FileChangeTracker } from '../services/validationHelpers';

export async function executeProjectList(input: { projectId: string; userId: string }): Promise<any> {
  const { projectId, userId } = input;
  
  try {
    const files = await storage.getProjectFiles(projectId, userId);
    
    return {
      success: true,
      files: files.map(f => ({
        filename: f.filename,
        language: f.language,
        size: f.content.length,
      })),
      message: `Found ${files.length} files in project`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to list project files',
    };
  }
}

export async function executeProjectRead(input: { projectId: string; userId: string; filename: string }): Promise<any> {
  const { projectId, userId, filename } = input;
  
  try {
    const files = await storage.getProjectFiles(projectId, userId);
    const file = files.find(f => f.filename === filename);
    
    if (!file) {
      return {
        success: false,
        error: `File "${filename}" not found in project`,
      };
    }
    
    return {
      success: true,
      filename: file.filename,
      content: file.content,
      language: file.language,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to read project file',
    };
  }
}

export async function executeProjectWrite(
  input: { 
    projectId: string; 
    userId: string; 
    filename: string; 
    content: string;
    language?: string;
  },
  tracker?: FileChangeTracker
): Promise<any> {
  const { projectId, userId, filename, content, language } = input;
  
  try {
    // Check if file exists
    const files = await storage.getProjectFiles(projectId, userId);
    const existingFile = files.find(f => f.filename === filename);
    
    if (existingFile) {
      if (tracker) {
        tracker.recordChange(filename, 'modify');
      }
      
      // Update existing file
      await storage.updateFile(existingFile.id, userId, content);
      return {
        success: true,
        action: 'updated',
        filename,
        message: `Updated ${filename}`,
      };
    } else {
      if (tracker) {
        tracker.recordChange(filename, 'create');
      }
      
      // Create new file
      await storage.createFile({
        projectId,
        userId,
        filename,
        content,
        language: language || 'plaintext',
      });
      return {
        success: true,
        action: 'created',
        filename,
        message: `Created ${filename}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to write project file',
    };
  }
}

export async function executeProjectDelete(
  input: { 
    projectId: string; 
    userId: string; 
    filename: string;
  },
  tracker?: FileChangeTracker
): Promise<any> {
  const { projectId, userId, filename } = input;
  
  try {
    const files = await storage.getProjectFiles(projectId, userId);
    const file = files.find(f => f.filename === filename);
    
    if (!file) {
      return {
        success: false,
        error: `File "${filename}" not found in project`,
      };
    }
    
    if (tracker) {
      tracker.recordChange(filename, 'delete');
    }
    
    await storage.deleteFile(file.id, userId);
    
    return {
      success: true,
      filename,
      message: `Deleted ${filename}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to delete project file',
    };
  }
}
