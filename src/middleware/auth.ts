/**
 * General Authentication Middleware
 *
 * Handles Supabase JWT token validation for all API endpoints
 * Uses the same Supabase authentication as the frontend apps
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../utils/supabase';
import logger from '../utils/logger';

// Extend Express Request interface to include user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
    name?: string;
  };
}

/**
 * Extract and validate Supabase JWT token from Authorization header
 * This middleware authenticates users using the same Supabase auth as frontend apps
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authorization token required. Please provide a Bearer token.',
      });
      return;
    }

    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.substring(7);

    // Validate token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.warn('Authentication failed:', {
        error: authError?.message,
        path: req.path,
        ip: req.ip,
      });

      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired token. Please log in again.',
      });
      return;
    }

    // Get user profile with role from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, name, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      logger.error('Failed to fetch user profile:', {
        userId: user.id,
        error: profileError.message,
      });

      // User exists in auth but no profile - still allow with basic info
      req.user = {
        id: user.id,
        email: user.email,
        role: 'player', // Default role if no profile
      };
    } else {
      // Attach user data to request
      req.user = {
        id: profile.id,
        email: profile.email || user.email,
        role: profile.role || 'player',
        name: profile.name,
      };
    }

    logger.info('User authenticated successfully:', {
      userId: req.user.id,
      role: req.user.role,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication failed due to server error',
    });
  }
};

/**
 * Require admin role
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required',
    });
    return;
  }

  next();
};

/**
 * Require admin or organizer role
 */
export const requireAdminOrOrganizer = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  const role = req.user.role;
  if (role !== 'admin' && role !== 'organizer') {
    res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin or organizer access required',
    });
    return;
  }

  next();
};

/**
 * Require authenticated user (any role)
 */
export const requireAuth = authenticateToken;

/**
 * Optional authentication - attach user if token provided but don't require it
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, continue without user
    next();
    return;
  }

  try {
    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, name, email')
        .eq('id', user.id)
        .single();

      if (profile) {
        req.user = {
          id: profile.id,
          email: profile.email || user.email,
          role: profile.role || 'player',
          name: profile.name,
        };
      }
    }

    next();
  } catch (error) {
    // Ignore errors in optional auth
    next();
  }
};

export default {
  authenticateToken,
  requireAuth,
  requireAdmin,
  requireAdminOrOrganizer,
  optionalAuth,
};
