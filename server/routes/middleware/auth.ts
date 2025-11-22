/**
 * Authentication Middleware
 * 
 * Provides middleware functions for protecting routes that require authentication.
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware to require authenticated user
 * Checks if req.user exists (populated by passport session)
 */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be logged in to access this resource',
    });
  }
  
  next();
}

/**
 * Middleware to require admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be logged in to access this resource',
    });
  }
  
  const user = req.user as any;
  if (user.role !== 'admin' && user.role !== 'owner') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You must be an admin to access this resource',
    });
  }
  
  next();
}

/**
 * Middleware to require owner role
 */
export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be logged in to access this resource',
    });
  }
  
  const user = req.user as any;
  if (user.role !== 'owner') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You must be the owner to access this resource',
    });
  }
  
  next();
}
