import {
  DuprPlayer,
  DuprRatingResponse,
  DuprValidationRequest,
  DuprValidationResponse,
} from '../types/dupr.types';
import logger from '../utils/logger';
import duprAuthService from './duprAuth.service';

class DuprPlayerService {
  private readonly apiVersion: string;
  constructor() {
    this.apiVersion = process.env.DUPR_API_VERSION || 'v1.0';
  }
  async validatePlayer(
    validationRequest: DuprValidationRequest
  ): Promise<DuprValidationResponse> {
    try {
      // Based on available DUPR API endpoints, this would typically be:
      // GET /players/{duprId} or POST /players/validate
      const response = await duprAuthService.makeAuthenticatedRequest(
        `/user/${this.apiVersion}/${validationRequest.duprId}`,
        'GET'
      );

      if (response.status === 200 && response.data.result) {
        const playerData = response.data.result;
        const player: DuprPlayer = {
          id: playerData.id || playerData.duprId,
          firstName: playerData.firstName || playerData.first_name,
          lastName: playerData.lastName || playerData.last_name,
          email: playerData.email,
          phone: playerData.phone,
          duprId: playerData.id,
          isActive: playerData.isActive !== false,
          createdAt:
            playerData.createdAt ||
            playerData.created_at ||
            new Date().toISOString(),
          updatedAt:
            playerData.updatedAt ||
            playerData.updated_at ||
            new Date().toISOString(),
          ...playerData,
        };

        logger.info(
          `Player validated successfully: ${validationRequest.duprId}`
        );

        return {
          isValid: true,
          player,
        };
      }

      return {
        isValid: false,
        error: 'Player not found in DUPR database',
      };
    } catch (error: any) {
      logger.error(
        `Player validation failed for DUPR ID: ${validationRequest.duprId}`,
        error
      );

      if (error.response?.status === 404) {
        return {
          isValid: false,
          error: 'Player not found in DUPR database',
        };
      }

      if (error.response?.status === 401) {
        return {
          isValid: false,
          error: 'Authentication failed with DUPR API',
        };
      }

      return {
        isValid: false,
        error: 'Failed to validate player with DUPR API',
      };
    }
  }

  async getPlayerRating(duprId: string): Promise<DuprRatingResponse | null> {
    try {
      // This might be a separate endpoint or part of the player info
      const response = await duprAuthService.makeAuthenticatedRequest(
        `/players/${duprId}/rating`,
        'GET'
      );

      if (response.status === 200 && response.data) {
        const ratingData = response.data;

        return {
          duprId,
          singlesRating: ratingData.singlesRating || ratingData.singles_rating,
          doublesRating: ratingData.doublesRating || ratingData.doubles_rating,
          reliability: ratingData.reliability,
          lastUpdated:
            ratingData.lastUpdated ||
            ratingData.last_updated ||
            new Date().toISOString(),
        };
      }

      return null;
    } catch (error: any) {
      logger.error(`Failed to get rating for DUPR ID: ${duprId}`, error);

      // Try to get rating from player info endpoint as fallback
      try {
        const playerResponse = await this.validatePlayer({ duprId });
        if (playerResponse.isValid && playerResponse.player) {
          return {
            duprId,
            singlesRating: playerResponse.player.singlesRating,
            doublesRating: playerResponse.player.doublesRating,
            reliability: playerResponse.player.reliability,
            lastUpdated: playerResponse.player.updatedAt,
          };
        }
      } catch (fallbackError) {
        logger.error('Fallback rating retrieval also failed', fallbackError);
      }

      return null;
    }
  }

  async getDuprIdByEmail(email: string): Promise<string | null> {
    try {
      logger.info(`Looking up DUPR ID for email: ${email}`);

      // Try specific email lookup endpoint first
      const response = await duprAuthService.makeAuthenticatedRequest(
        `/${this.apiVersion}/player/duprid-by-email`,
        'POST',
        { email: email }
      );
      if (response.status === 200 && response.data) {
        return response.data || null;
      }

      // Fallback to search if direct lookup not available
      const searchResponse = await duprAuthService.makeAuthenticatedRequest(
        `/players/search?email=${encodeURIComponent(email)}`,
        'GET'
      );

      if (searchResponse.status === 200 && searchResponse.data) {
        const players = Array.isArray(searchResponse.data)
          ? searchResponse.data
          : [searchResponse.data];

        // Find exact email match
        const matchedPlayer = players.find(
          (player: any) =>
            player.email && player.email.toLowerCase() === email.toLowerCase()
        );

        if (matchedPlayer) {
          logger.info(
            `Found DUPR ID for email ${email}: ${
              matchedPlayer.duprId || matchedPlayer.id
            }`
          );
          return matchedPlayer.duprId || matchedPlayer.id || null;
        }
      }

      logger.warn(`No DUPR ID found for email: ${email}`);
      return null;
    } catch (error: any) {
      logger.error(`Failed to get DUPR ID for email: ${email}`, error);

      if (error.response?.status === 404) {
        return null;
      }

      if (error.response?.status === 401) {
        throw new Error('Authentication failed with DUPR API');
      }

      return null;
    }
  }

  async searchPlayers(query: string): Promise<DuprPlayer[]> {
    try {
      // Search endpoint might accept name, email, or other criteria
      const response = await duprAuthService.makeAuthenticatedRequest(
        `/players/search?q=${encodeURIComponent(query)}`,
        'GET'
      );

      if (response.status === 200 && response.data) {
        return response.data.map((playerData: any) => ({
          id: playerData.id || playerData.duprId,
          firstName: playerData.firstName || playerData.first_name,
          lastName: playerData.lastName || playerData.last_name,
          email: playerData.email,
          phone: playerData.phone,
          duprId: playerData.duprId || playerData.id,
          singlesRating: playerData.singlesRating || playerData.singles_rating,
          doublesRating: playerData.doublesRating || playerData.doubles_rating,
          reliability: playerData.reliability,
          isActive: playerData.isActive !== false,
          createdAt:
            playerData.createdAt ||
            playerData.created_at ||
            new Date().toISOString(),
          updatedAt:
            playerData.updatedAt ||
            playerData.updated_at ||
            new Date().toISOString(),
        }));
      }

      return [];
    } catch (error) {
      logger.error(`Player search failed for query: ${query}`, error);
      return [];
    }
  }
}

export default new DuprPlayerService();
