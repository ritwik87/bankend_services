/**
 * Auction Authorization Middleware
 * 
 * Handles role-based access control for auction management endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../utils/supabase';
import logger from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role?: string;
    email?: string;
  };
}

// Extract user from Authorization header
const extractUserFromToken = async (token: string) => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw error;

    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, name')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    return {
      id: user.id,
      email: user.email,
      role: profile.role
    };
  } catch (error) {
    return null;
  }
};

// Get user's team ownership/captainship
const getUserTeamAccess = async (userId: string, leagueId?: string) => {
  try {
    let query = supabase
      .from('league_teams')
      .select('id, league_id, name')
      .or(`owner_id.eq.${userId},captain_id.eq.${userId}`);

    if (leagueId) {
      query = query.eq('league_id', leagueId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  } catch (error) {
    logger.error('getUserTeamAccess error:', error);
    return [];
  }
};

// Check if user created/organizes the league
const checkOrganizerAccess = async (userId: string, leagueId: string) => {
  try {
    const { data, error } = await supabase
      .from('leagues')
      .select('organizer_id')
      .eq('id', leagueId)
      .single();

    if (error) return false;
    return data.organizer_id === userId;
  } catch (error) {
    logger.error('checkOrganizerAccess error:', error);
    return false;
  }
};

// Main authentication middleware
export const authenticateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
      return;
    }

    const token = authHeader.substring(7);
    const user = await extractUserFromToken(token);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Admin only access
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
    return;
  }
  next();
};

// Admin or Organizer access
export const requireAdminOrOrganizer = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'organizer') {
    res.status(403).json({
      success: false,
      error: 'Admin or organizer access required'
    });
    return;
  }
  next();
};

// Check auction access (admin, organizer of league, or team owner/captain)
export const checkAuctionAccess = (action: 'read' | 'write' | 'bid' | 'manage') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Admin has full access
      if (role === 'admin') {
        return next();
      }

      // Get auction details to check league
      const auctionId = req.params.auctionId || req.params.id;
      let leagueId: string | undefined;

      if (auctionId) {
        const { data: auction, error } = await supabase
          .from('auctions')
          .select('league_id')
          .eq('id', auctionId)
          .single();

        if (!error && auction) {
          leagueId = auction.league_id;
        }
      }

      // For read access, basic players can view
      if (action === 'read' && role === 'player') {
        return next();
      }

      // Check organizer access
      if (role === 'organizer' && leagueId) {
        const isOrganizer = await checkOrganizerAccess(userId, leagueId);
        if (isOrganizer) {
          return next();
        }
      }

      // Check team owner/captain access
      const userTeams = await getUserTeamAccess(userId, leagueId);
      if (userTeams.length > 0) {
        // Team owners/captains can bid and manage their teams
        if (action === 'bid' || (action === 'write' && req.body?.teamId && userTeams.some((t: any) => t.id === req.body.teamId))) {
          return next();
        }
        // Can manage auctions in their league
        if (action === 'manage' && leagueId && userTeams.some((t: any) => t.league_id === leagueId)) {
          return next();
        }
      }

      // Deny access
      const actionMessages = {
        read: 'view auctions',
        write: 'modify auctions',
        bid: 'place bids',
        manage: 'manage auctions'
      };

      res.status(403).json({
        success: false,
        error: `You don't have permission to ${actionMessages[action]}. Contact an admin if you need access.`
      });

    } catch (error) {
      logger.error('checkAuctionAccess error:', error);
      res.status(500).json({
        success: false,
        error: 'Authorization check failed'
      });
    }
  };
};

// Specific middleware functions for common use cases
export const canReadAuctions = checkAuctionAccess('read');
export const canWriteAuctions = checkAuctionAccess('write');
export const canPlaceBids = checkAuctionAccess('bid');
export const canManageAuctions = checkAuctionAccess('manage');

// Team-specific bid authorization
export const checkBidPermission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { teamId } = req.body;

    if (!userId || !teamId) {
      return res.status(400).json({
        success: false,
        error: 'User ID and team ID required'
      });
    }

    // Admin can bid for any team
    if (role === 'admin') {
      return next();
    }

    // Check if user is owner or captain of the specific team
    const { data: team, error } = await supabase
      .from('league_teams')
      .select('owner_id, captain_id, league_id')
      .eq('id', teamId)
      .single();

    if (error || !team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    const canBid = team.owner_id === userId || team.captain_id === userId;
    
    if (!canBid) {
      // Check if user is organizer of the league
      const isOrganizer = await checkOrganizerAccess(userId, team.league_id);
      if (!isOrganizer) {
        return res.status(403).json({
          success: false,
          error: 'You can only place bids for teams where you are the owner or captain'
        });
      }
    }

    next();
  } catch (error) {
    logger.error('checkBidPermission error:', error);
    res.status(500).json({
      success: false,
      error: 'Bid permission check failed'
    });
  }
};

export default {
  authenticateUser,
  requireAdmin,
  requireAdminOrOrganizer,
  canReadAuctions,
  canWriteAuctions,
  canPlaceBids,
  canManageAuctions,
  checkBidPermission
};