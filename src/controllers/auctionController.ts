/**
 * Auction Controller
 *
 * Handles HTTP requests for auction management operations
 */

import { Request, Response } from 'express';
import auctionService from '../services/auction.service';
import {
  CompletePlayerAuctionRequest,
  CreateAuctionRequest,
  CreateAuctionSettingsRequest,
  PlaceBidRequest,
  SetupAuctionPlayersRequest,
  UpdateAuctionRequest,
} from '../types/auction.types';
import logger from '../utils/logger';

export class AuctionController {
  /**
   * @swagger
   * /api/auction/auctions:
   *   get:
   *     summary: Get all auctions
   *     tags: [Auction Management]
   *     responses:
   *       200:
   *         description: List of auctions
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Auction'
   */
  static async getAuctions(req: Request, res: Response) {
    try {
      const auctions = await auctionService.getAuctions();

      res.json({
        success: true,
        data: auctions,
      });
    } catch (error) {
      logger.error('AuctionController.getAuctions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch auctions',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}:
   *   get:
   *     summary: Get auction by ID
   *     tags: [Auction Management]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Auction ID
   *     responses:
   *       200:
   *         description: Auction details with enhanced status
   *       404:
   *         description: Auction not found
   */
  static async getAuctionById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const auction = await auctionService.getAuctionById(id);

      if (!auction) {
        return res.status(404).json({
          success: false,
          error: 'Auction not found',
        });
      }

      return res.json({
        success: true,
        data: auction,
      });
    } catch (error) {
      logger.error('AuctionController.getAuctionById error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch auction',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions:
   *   post:
   *     summary: Create new auction
   *     tags: [Auction Management]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateAuctionRequest'
   *     responses:
   *       201:
   *         description: Auction created successfully
   *       400:
   *         description: Invalid request data
   */
  static async createAuction(req: Request, res: Response) {
    try {
      const userId = req.body?.created_by;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required',
        });
      }

      const auctionData: CreateAuctionRequest = req.body;
      const auction = await auctionService.createAuction(userId, auctionData);

      return res.status(201).json({
        success: true,
        data: auction,
      });
    } catch (error) {
      logger.error('AuctionController.createAuction error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create auction',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}:
   *   put:
   *     summary: Update auction
   *     tags: [Auction Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateAuctionRequest'
   *     responses:
   *       200:
   *         description: Auction updated successfully
   */
  static async updateAuction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: UpdateAuctionRequest = req.body;

      const auction = await auctionService.updateAuction(id, updateData);

      res.json({
        success: true,
        data: auction,
      });
    } catch (error) {
      logger.error('AuctionController.updateAuction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update auction',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}:
   *   delete:
   *     summary: Delete auction
   *     tags: [Auction Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Auction deleted successfully
   */
  static async deleteAuction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await auctionService.deleteAuction(id);

      res.json({
        success: true,
        message: 'Auction deleted successfully',
      });
    } catch (error) {
      logger.error('AuctionController.deleteAuction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete auction',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}/setup-players:
   *   post:
   *     summary: Setup auction players
   *     tags: [Auction Management]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               sport_id:
   *                 type: string
   *     responses:
   *       200:
   *         description: Players setup successfully
   */
  static async setupAuctionPlayers(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { sport_id } = req.body;

      const request: SetupAuctionPlayersRequest = {
        auction_id: id,
        sport_id,
      };

      const result = await auctionService.setupAuctionPlayers(request);

      res.json({
        success: true,
        data: result,
        message: `Successfully added ${result.count} players to auction`,
      });
    } catch (error) {
      logger.error('AuctionController.setupAuctionPlayers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to setup auction players',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}/players:
   *   get:
   *     summary: Get auction players
   *     tags: [Auction Management]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of auction players
   */
  static async getAuctionPlayers(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const players = await auctionService.getAuctionPlayers(id);

      res.json({
        success: true,
        data: players,
      });
    } catch (error) {
      logger.error('AuctionController.getAuctionPlayers error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch auction players',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}/start:
   *   post:
   *     summary: Start auction
   *     tags: [Auction Control]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Auction started successfully
   */
  static async startAuction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const auction = await auctionService.startAuction(id);

      res.json({
        success: true,
        data: auction,
        message: 'Auction started successfully',
      });
    } catch (error) {
      logger.error('AuctionController.startAuction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start auction',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}/pause:
   *   post:
   *     summary: Pause auction
   *     tags: [Auction Control]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Auction paused successfully
   */
  static async pauseAuction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const auction = await auctionService.pauseAuction(id);

      res.json({
        success: true,
        data: auction,
        message: 'Auction paused successfully',
      });
    } catch (error) {
      logger.error('AuctionController.pauseAuction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to pause auction',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}/resume:
   *   post:
   *     summary: Resume auction
   *     tags: [Auction Control]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Auction resumed successfully
   */
  static async resumeAuction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const auction = await auctionService.resumeAuction(id);

      res.json({
        success: true,
        data: auction,
        message: 'Auction resumed successfully',
      });
    } catch (error) {
      logger.error('AuctionController.resumeAuction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resume auction',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}/next-player:
   *   post:
   *     summary: Move to next player
   *     tags: [Auction Control]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Moved to next player successfully
   */
  static async nextPlayer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const auction = await auctionService.nextPlayer(id);

      res.json({
        success: true,
        data: auction,
        message:
          auction.status === 'completed'
            ? 'Auction completed'
            : 'Moved to next player',
      });
    } catch (error) {
      logger.error('AuctionController.nextPlayer error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to move to next player',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}/complete:
   *   post:
   *     summary: Complete auction
   *     tags: [Auction Control]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Auction completed successfully
   */
  static async completeAuction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const auction = await auctionService.completeAuction(id);

      res.json({
        success: true,
        data: auction,
        message: 'Auction completed successfully',
      });
    } catch (error) {
      logger.error('AuctionController.completeAuction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete auction',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/bids/validate:
   *   post:
   *     summary: Validate bid
   *     tags: [Bidding]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/PlaceBidRequest'
   *     responses:
   *       200:
   *         description: Bid validation result
   */
  static async validateBid(req: Request, res: Response) {
    try {
      const bidRequest: PlaceBidRequest = req.body;
      const validation = await auctionService.validateBid(bidRequest);

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      logger.error('AuctionController.validateBid error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate bid',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/bids:
   *   post:
   *     summary: Place bid
   *     tags: [Bidding]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/PlaceBidRequest'
   *     responses:
   *       200:
   *         description: Bid placed successfully
   *       400:
   *         description: Invalid bid
   */
  static async placeBid(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required',
        });
      }

      const bidRequest: PlaceBidRequest = req.body;
      const result = await auctionService.placeBid(userId, bidRequest);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      return res.json({
        success: true,
        data: result,
        message: 'Bid placed successfully',
      });
    } catch (error) {
      logger.error('AuctionController.placeBid error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to place bid',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}/bids:
   *   get:
   *     summary: Get bids for auction
   *     tags: [Bidding]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: player_id
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of bids
   */
  static async getBids(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { player_id } = req.query;

      const bids = await auctionService.getBids(id, player_id as string);

      res.json({
        success: true,
        data: bids,
      });
    } catch (error) {
      logger.error('AuctionController.getBids error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch bids',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/players/complete:
   *   post:
   *     summary: Complete player auction (sell to highest bidder)
   *     tags: [Auction Control]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CompletePlayerAuctionRequest'
   *     responses:
   *       200:
   *         description: Player auction completed successfully
   */
  static async completePlayerAuction(req: Request, res: Response) {
    try {
      const request: CompletePlayerAuctionRequest = req.body;
      const success = await auctionService.completePlayerAuction(request);

      res.json({
        success: true,
        data: { completed: success },
        message: success
          ? 'Player sold successfully'
          : 'Failed to complete player auction',
      });
    } catch (error) {
      logger.error('AuctionController.completePlayerAuction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete player auction',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}/funds:
   *   get:
   *     summary: Get team funds for auction
   *     tags: [Team Management]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: team_id
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of team funds
   */
  static async getTeamFunds(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { team_id } = req.query;

      const funds = await auctionService.getTeamFunds(id, team_id as string);

      res.json({
        success: true,
        data: funds,
      });
    } catch (error) {
      logger.error('AuctionController.getTeamFunds error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch team funds',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}/settings:
   *   get:
   *     summary: Get auction settings
   *     tags: [Auction Management]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Auction settings
   *       404:
   *         description: Settings not found
   */
  static async getAuctionSettings(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const settings = await auctionService.getAuctionSettings(id);

      if (!settings) {
        return res.status(404).json({
          success: false,
          error: 'Auction settings not found',
        });
      }

      return res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      logger.error('AuctionController.getAuctionSettings error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch auction settings',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/settings:
   *   post:
   *     summary: Create or update auction settings
   *     tags: [Auction Management]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateAuctionSettingsRequest'
   *     responses:
   *       200:
   *         description: Settings saved successfully
   */
  static async upsertAuctionSettings(req: Request, res: Response) {
    try {
      const settingsData: CreateAuctionSettingsRequest = req.body;
      const settings = await auctionService.upsertAuctionSettings(settingsData);

      res.json({
        success: true,
        data: settings,
        message: 'Settings saved successfully',
      });
    } catch (error) {
      logger.error('AuctionController.upsertAuctionSettings error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save auction settings',
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * @swagger
   * /api/auction/auctions/{id}/purchases:
   *   get:
   *     summary: Get player purchases (final roster)
   *     tags: [Team Management]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: team_id
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of player purchases
   */
  static async getPlayerPurchases(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { team_id } = req.query;

      const purchases = await auctionService.getPlayerPurchases(
        id,
        team_id as string
      );

      res.json({
        success: true,
        data: purchases,
      });
    } catch (error) {
      logger.error('AuctionController.getPlayerPurchases error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch player purchases',
        details: error instanceof Error ? error.message : error,
      });
    }
  }
}

// Add user interface extension for TypeScript
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
      };
    }
  }
}
