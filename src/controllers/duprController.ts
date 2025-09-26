import { Request, Response } from 'express';
import { ApiResponse, DuprValidationRequest, DuprMatchUploadRequest, DuprMatchUploadResponse, DuprBatchUploadResponse } from '../types/dupr.types';
import duprPlayerService from '../services/duprPlayer.service';
import duprMatchService from '../services/duprMatch.service';
import { validateRequest, duprValidationSchema, duprIdSchema } from '../utils/validation';
import logger from '../utils/logger';

export class DuprController {
  async validatePlayer(req: Request, res: Response): Promise<void> {
    try {
      const validationRequest: DuprValidationRequest = validateRequest(
        duprValidationSchema,
        req.body
      );

      const validationResponse = await duprPlayerService.validatePlayer(validationRequest);

      const response: ApiResponse<typeof validationResponse> = {
        success: validationResponse.isValid,
        data: validationResponse,
        message: validationResponse.isValid 
          ? 'Player validated successfully' 
          : 'Player validation failed'
      };

      res.status(validationResponse.isValid ? 200 : 400).json(response);
    } catch (error: any) {
      logger.error('Validation controller error', error);
      
      const response: ApiResponse<null> = {
        success: false,
        error: error.message || 'Internal server error',
        message: 'Failed to validate player'
      };

      res.status(400).json(response);
    }
  }

  async getPlayerRating(req: Request, res: Response): Promise<void> {
    try {
      const { duprId } = validateRequest(duprIdSchema, req.params);

      const ratingResponse = await duprPlayerService.getPlayerRating(duprId);

      if (ratingResponse) {
        const response: ApiResponse<typeof ratingResponse> = {
          success: true,
          data: ratingResponse,
          message: 'Player rating retrieved successfully'
        };

        res.status(200).json(response);
      } else {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Rating not found',
          message: 'Player rating could not be retrieved'
        };

        res.status(404).json(response);
      }
    } catch (error: any) {
      logger.error('Get rating controller error', error);
      
      const response: ApiResponse<null> = {
        success: false,
        error: error.message || 'Internal server error',
        message: 'Failed to retrieve player rating'
      };

      res.status(400).json(response);
    }
  }

  async getDuprIdByEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Email parameter is required',
          message: 'Please provide a valid email address'
        };

        res.status(400).json(response);
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid email format',
          message: 'Please provide a valid email address'
        };

        res.status(400).json(response);
        return;
      }

      const duprId = await duprPlayerService.getDuprIdByEmail(email);

      if (duprId) {
        const response: ApiResponse<{ email: string; duprId: string }> = {
          success: true,
          data: { email, duprId },
          message: 'DUPR ID found for email'
        };

        res.status(200).json(response);
      } else {
        const response: ApiResponse<null> = {
          success: false,
          error: 'DUPR ID not found',
          message: 'No DUPR ID found for the provided email address'
        };

        res.status(404).json(response);
      }
    } catch (error: any) {
      logger.error('Get DUPR ID by email controller error', error);
      
      const response: ApiResponse<null> = {
        success: false,
        error: error.message || 'Internal server error',
        message: 'Failed to retrieve DUPR ID'
      };

      res.status(500).json(response);
    }
  }

  async searchPlayers(req: Request, res: Response): Promise<void> {
    try {
      const { q: query } = req.query;

      if (!query || typeof query !== 'string') {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Query parameter is required',
          message: 'Please provide a search query'
        };

        res.status(400).json(response);
        return;
      }

      const players = await duprPlayerService.searchPlayers(query);

      const response: ApiResponse<typeof players> = {
        success: true,
        data: players,
        message: `Found ${players.length} players`
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Search players controller error', error);
      
      const response: ApiResponse<null> = {
        success: false,
        error: error.message || 'Internal server error',
        message: 'Failed to search players'
      };

      res.status(500).json(response);
    }
  }

  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Simple health check - could be expanded to test DUPR API connectivity
      const response: ApiResponse<{ status: string; timestamp: string }> = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString()
        },
        message: 'DUPR service is healthy'
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Health check error', error);
      
      const response: ApiResponse<null> = {
        success: false,
        error: 'Service unhealthy',
        message: 'DUPR service health check failed'
      };

      res.status(503).json(response);
    }
  }

  async uploadMatch(req: Request, res: Response): Promise<void> {
    try {
      const matchData: DuprMatchUploadRequest = req.body;

      // Validate required fields
      if (!matchData.event || !matchData.identifier || !matchData.matchDate || !matchData.teamA || !matchData.teamB) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Missing required fields',
          message: 'Event, identifier, matchDate, teamA, and teamB are required'
        };

        res.status(400).json(response);
        return;
      }

      const uploadResponse = await duprMatchService.uploadMatch(matchData);

      if (uploadResponse.success) {
        const response: ApiResponse<DuprMatchUploadResponse> = {
          success: true,
          data: uploadResponse,
          message: 'Match uploaded successfully to DUPR'
        };

        res.status(200).json(response);
      } else {
        const response: ApiResponse<null> = {
          success: false,
          error: uploadResponse.error || 'Upload failed',
          message: uploadResponse.message || 'Failed to upload match to DUPR'
        };

        res.status(400).json(response);
      }
    } catch (error: any) {
      logger.error('Upload match controller error', error);

      const response: ApiResponse<null> = {
        success: false,
        error: error.message || 'Internal server error',
        message: 'Failed to upload match'
      };

      res.status(500).json(response);
    }
  }

  async uploadMatches(req: Request, res: Response): Promise<void> {
    try {
      const { matches } = req.body;

      if (!matches || !Array.isArray(matches) || matches.length === 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid matches data',
          message: 'Matches array is required and cannot be empty'
        };

        res.status(400).json(response);
        return;
      }

      const batchResponse = await duprMatchService.uploadMatches(matches);

      const response: ApiResponse<DuprBatchUploadResponse> = {
        success: batchResponse.successful > 0,
        data: batchResponse,
        message: `Upload completed: ${batchResponse.successful} successful, ${batchResponse.failed} failed`
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Upload matches batch controller error', error);

      const response: ApiResponse<null> = {
        success: false,
        error: error.message || 'Internal server error',
        message: 'Failed to upload matches batch'
      };

      res.status(500).json(response);
    }
  }
}

export default new DuprController();