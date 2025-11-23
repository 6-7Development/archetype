/**
 * Project Protection Middleware
 * Validates file changes before they're applied
 * Used in code submission endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { validateFileChange, validateBatchChanges } from '../services/project-change-validator';

/**
 * Middleware to validate file changes
 */
export async function validateProjectChanges(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { projectId } = req.params;
  const { files, singleFile } = req.body;
  const userId = (req.user as any)?.id;

  if (!projectId || !userId) {
    return res.status(400).json({ success: false, error: 'Missing projectId or userId' });
  }

  try {
    // Single file change
    if (singleFile) {
      const result = await validateFileChange(projectId, {
        filePath: singleFile.path,
        operation: singleFile.operation || 'modify',
        content: singleFile.content,
        userId,
        reason: req.body.reason,
      });

      // Attach validation result to request
      (req as any).changeValidation = result;

      if (!result.allowed) {
        return res.status(403).json({ success: false, ...result });
      }

      return next();
    }

    // Batch file changes
    if (files && Array.isArray(files)) {
      const results = await validateBatchChanges(
        projectId,
        files.map((f: any) => ({
          filePath: f.path,
          operation: f.operation || 'modify',
          content: f.content,
          userId,
          reason: req.body.reason,
        }))
      );

      // Attach results to request
      (req as any).batchValidation = results;

      // If any files are blocked, reject entire batch
      if (results.blockedChanges.length > 0) {
        return res.status(403).json({
          success: false,
          error: 'Some files are protected and cannot be modified',
          ...results,
        });
      }

      return next();
    }

    next();
  } catch (error) {
    console.error('[PROJECT-PROTECTION] Validation error:', error);
    res.status(500).json({ success: false, error: 'Validation failed' });
  }
}
