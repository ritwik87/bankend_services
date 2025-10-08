/**
 * Auction Routes
 *
 * Defines API routes for auction management operations
 */

import { Router } from 'express';
import { AuctionController } from '../controllers/auctionController';
import { canManageAuctions, canReadAuctions } from '../middleware/auctionAuth';
import { requireAuth } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiting to auction routes
const auctionRateLimit = createRateLimiter(15 * 60 * 1000, 100); // 15 minutes, 100 requests
const biddingRateLimit = createRateLimiter(1 * 60 * 1000, 10); // 1 minute, 10 requests

/**
 * @swagger
 * components:
 *   schemas:
 *     Auction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         tournament_id:
 *           type: string
 *         league_id:
 *           type: string
 *         status:
 *           type: string
 *           enum: [upcoming, active, paused, completed, cancelled]
 *         current_player_id:
 *           type: string
 *         start_time:
 *           type: string
 *         end_time:
 *           type: string
 *         bid_increment:
 *           type: number
 *         max_bid_time_seconds:
 *           type: number
 *         created_by:
 *           type: string
 *         created_at:
 *           type: string
 *         updated_at:
 *           type: string
 *
 *     CreateAuctionRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         tournament_id:
 *           type: string
 *         league_id:
 *           type: string
 *         bid_increment:
 *           type: number
 *         max_bid_time_seconds:
 *           type: number
 *
 *     UpdateAuctionRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: string
 *           enum: [upcoming, active, paused, completed, cancelled]
 *         current_player_id:
 *           type: string
 *         start_time:
 *           type: string
 *         end_time:
 *           type: string
 *         bid_increment:
 *           type: number
 *         max_bid_time_seconds:
 *           type: number
 *
 *     PlaceBidRequest:
 *       type: object
 *       required:
 *         - auction_id
 *         - player_id
 *         - team_id
 *         - amount
 *       properties:
 *         auction_id:
 *           type: string
 *         player_id:
 *           type: string
 *         team_id:
 *           type: string
 *         amount:
 *           type: number
 *
 *     CreateAuctionSettingsRequest:
 *       type: object
 *       required:
 *         - auction_id
 *       properties:
 *         auction_id:
 *           type: string
 *         max_players_per_team:
 *           type: number
 *         min_players_per_team:
 *           type: number
 *         salary_cap:
 *           type: number
 *         bid_increment_amount:
 *           type: number
 *         bid_time_limit_seconds:
 *           type: number
 *         auto_bid_enabled:
 *           type: boolean
 *         allow_bid_retraction:
 *           type: boolean
 *         require_minimum_bid:
 *           type: boolean
 *
 *     CompletePlayerAuctionRequest:
 *       type: object
 *       required:
 *         - auction_id
 *         - player_id
 *         - winning_team_id
 *         - final_price
 *       properties:
 *         auction_id:
 *           type: string
 *         player_id:
 *           type: string
 *         winning_team_id:
 *           type: string
 *         final_price:
 *           type: number
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// Apply authentication to all routes
// router.use(authenticateUser);

// Auction Management Routes
router.get(
  '/auctions',
  auctionRateLimit,
  //   canReadAuctions,
  AuctionController.getAuctions
);
router.get(
  '/auctions/:id',
  auctionRateLimit,
  //   canReadAuctions,
  AuctionController.getAuctionById
);
router.post(
  '/auctions',
  auctionRateLimit,
  //   canWriteAuctions,
  AuctionController.createAuction
);
router.put(
  '/auctions/:id',
  auctionRateLimit,
  //   canWriteAuctions,
  AuctionController.updateAuction
);
router.delete(
  '/auctions/:id',
  auctionRateLimit,
  //   requireAdmin,
  AuctionController.deleteAuction
);

// Auction Setup Routes (Admin/Organizer only)
router.post(
  '/auctions/:id/setup-players',
  auctionRateLimit,
  //   canManageAuctions,
  AuctionController.setupAuctionPlayers
);
router.get(
  '/auctions/:id/players',
  auctionRateLimit,
  //   canReadAuctions,
  AuctionController.getAuctionPlayers
);

// Auction Control Routes (Admin/Organizer/Team Owner-Captain)
router.post(
  '/auctions/:id/start',
  auctionRateLimit,
  //   canManageAuctions,
  AuctionController.startAuction
);
router.post(
  '/auctions/:id/pause',
  auctionRateLimit,
  //   canManageAuctions,
  AuctionController.pauseAuction
);
router.post(
  '/auctions/:id/resume',
  auctionRateLimit,
  //   canManageAuctions,
  AuctionController.resumeAuction
);
router.post(
  '/auctions/:id/next-player',
  auctionRateLimit,
  //   canManageAuctions,
  AuctionController.nextPlayer
);
router.post(
  '/auctions/:id/complete',
  auctionRateLimit,
  //   canManageAuctions,
  AuctionController.completeAuction
);

// Bidding Routes (Team Owner/Captain for their team)
router.post(
  '/bids/validate',
  biddingRateLimit,
  //   canPlaceBids,
  AuctionController.validateBid
);
router.post(
  '/bids',
  biddingRateLimit,
  //   checkBidPermission,
  AuctionController.placeBid
);
router.get(
  '/auctions/:id/bids',
  auctionRateLimit,
  //   canReadAuctions,
  AuctionController.getBids
);

// Player Auction Routes (Admin/Organizer/Team Owner-Captain)
router.post(
  '/players/complete',
  requireAuth,
  auctionRateLimit,
  canManageAuctions,
  AuctionController.completePlayerAuction
);

// Team Management Routes
router.get(
  '/auctions/:id/funds',
  auctionRateLimit,
  //   canReadAuctions,
  AuctionController.getTeamFunds
);
router.get(
  '/auctions/:id/purchases',
  auctionRateLimit,
  //   canReadAuctions,
  AuctionController.getPlayerPurchases
);

// Settings Routes (Admin/Organizer/Team Owner-Captain)
router.get(
  '/auctions/:id/settings',
  requireAuth,
  auctionRateLimit,
  canReadAuctions,
  AuctionController.getAuctionSettings
);
router.post(
  '/settings',
  requireAuth,
  auctionRateLimit,
  canManageAuctions,
  AuctionController.upsertAuctionSettings
);

/**
 * @swagger
 * tags:
 *   - name: Auction Management
 *     description: Auction creation, update, and management operations
 *   - name: Auction Control
 *     description: Auction flow control operations (start, pause, next player, etc.)
 *   - name: Bidding
 *     description: Real-time bidding operations
 *   - name: Team Management
 *     description: Team funds and roster management
 */

export default router;
