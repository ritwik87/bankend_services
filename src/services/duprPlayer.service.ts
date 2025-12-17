import {
  DuprPlayer,
  DuprRatingResponse,
  DuprValidationRequest,
  DuprValidationResponse,
} from '../types/dupr.types';
import logger from '../utils/logger';
import supabase from '../utils/supabase';
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

  async batchUpdatePlayersDuprData({
    leagueId,
    batchSize = 10,
  }: {
    leagueId?: string;
    batchSize?: number;
  }): Promise<{
    success: boolean;
    message: string;
    processed: number;
    updated: number;
    errors: number;
    results?: Array<{
      userId: string;
      duprId: string;
      success: boolean;
      error?: string;
    }>;
    error?: string;
  }> {
    try {
      logger.info(
        `Starting batch DUPR data update with league_id: ${
          leagueId || 'all'
        }, batch size: ${batchSize}`
      );

      let users: any[] = [];

      if (leagueId) {
        // Get users registered in the specific league
        logger.info(`Fetching players registered in league: ${leagueId}`);
        const { data: leagueUsers, error: leagueUsersError } = await supabase
          .from('league_registrations')
          .select(
            `
            profiles!league_registrations_player_id_fkey(
              id,
              dupr_id,
              name,
              email
            )
          `
          )
          .eq('league_id', leagueId)
          .not('profiles.dupr_id', 'is', null)
          .not('profiles.dupr_id', 'eq', '');

        if (leagueUsersError) {
          logger.error('Failed to fetch league users:', leagueUsersError);
          return {
            success: false,
            message: 'Failed to fetch users from league registrations',
            processed: 0,
            updated: 0,
            errors: 1,
            error: leagueUsersError.message,
          };
        }

        console.log('player res', JSON.stringify(leagueUsers));

        // Extract unique users from league registrations
        const uniqueUserMap = new Map();
        leagueUsers?.forEach((registration: any) => {
          if (registration.profiles) {
            uniqueUserMap.set(registration.profiles.id, registration.profiles);
          }
        });
        users = Array.from(uniqueUserMap.values());
      } else {
        // Get all users who have a dupr_id
        logger.info('Fetching all users with DUPR IDs');
        const { data: allUsers, error: allUsersError } = await supabase
          .from('profiles')
          .select('id, dupr_id, name, email')
          .not('dupr_id', 'is', null)
          .not('dupr_id', 'eq', '');

        if (allUsersError) {
          logger.error(
            'Failed to fetch all users with DUPR IDs:',
            allUsersError
          );
          return {
            success: false,
            message: 'Failed to fetch users from database',
            processed: 0,
            updated: 0,
            errors: 1,
            error: allUsersError.message,
          };
        }

        users = allUsers || [];
      }

      if (!users || users.length === 0) {
        logger.info(
          `No users with DUPR IDs found ${
            leagueId ? 'in the specified league' : ''
          }`
        );
        return {
          success: true,
          message: `No users with DUPR IDs found ${
            leagueId ? 'in the specified league' : ''
          }`,
          processed: 0,
          updated: 0,
          errors: 0,
        };
      }

      logger.info(
        `Found ${users.length} users to update ${
          leagueId ? 'in league ' + leagueId : 'across all users'
        }`
      );

      // Process users in batches
      const results: Array<{
        userId: string;
        duprId: string;
        success: boolean;
        error?: string;
      }> = [];

      let updated = 0;
      let errors = 0;

      // Process in batches of specified size
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        logger.info(
          `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            users.length / batchSize
          )} (${batch.length} users)`
        );

        // Process each batch using Promise.allSettled to handle individual failures
        const batchResults = await Promise.allSettled(
          batch.map(async (user) => {
            try {
              logger.info(
                `Updating DUPR data for user ${user.id} (DUPR ID: ${user.dupr_id})`
              );

              // Validate player to get latest data
              const validationResponse = await this.validatePlayer({
                duprId: user.dupr_id,
              });

              if (validationResponse.isValid && validationResponse.player) {
                // Update user's DUPR data in the database (matching main project pattern)
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({
                    dupr_validated: true,
                    dupr_validation_error: null,
                    dupr_player_data: validationResponse.player,
                    dupr_validated_at: new Date().toISOString(),
                    dupr_validation_attempted_at: new Date().toISOString(),
                  })
                  .eq('id', user.id);

                if (updateError) {
                  logger.error(
                    `Failed to update DUPR data for user ${user.id}:`,
                    updateError
                  );
                  return {
                    userId: user.id,
                    duprId: user.dupr_id,
                    success: false,
                    error: updateError.message,
                  };
                }

                logger.info(
                  `Successfully updated DUPR data for user ${user.id}`
                );
                return {
                  userId: user.id,
                  duprId: user.dupr_id,
                  success: true,
                };
              } else {
                // Store validation failure in database (matching main project pattern)
                const validationError =
                  validationResponse.error || 'Player validation failed';

                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({
                    dupr_validated: false,
                    dupr_validation_error: validationError,
                    dupr_validated_at: null,
                    dupr_validation_attempted_at: new Date().toISOString(),
                  })
                  .eq('id', user.id);

                if (updateError) {
                  logger.error(
                    `Failed to update DUPR validation failure for user ${user.id}:`,
                    updateError
                  );
                }

                logger.warn(
                  `Failed to validate DUPR player ${user.dupr_id} for user ${user.id}: ${validationError}`
                );
                return {
                  userId: user.id,
                  duprId: user.dupr_id,
                  success: false,
                  error: validationError,
                };
              }
            } catch (error: any) {
              logger.error(`Error processing user ${user.id}:`, error);
              return {
                userId: user.id,
                duprId: user.dupr_id,
                success: false,
                error: error.message || 'Unknown error occurred',
              };
            }
          })
        );

        // Process batch results
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
            if (result.value.success) {
              updated++;
            } else {
              errors++;
            }
          } else {
            errors++;
            results.push({
              userId: 'unknown',
              duprId: 'unknown',
              success: false,
              error: result.reason?.message || 'Promise rejected',
            });
          }
        });

        // Add a small delay between batches to avoid overwhelming the DUPR API
        if (i + batchSize < users.length) {
          logger.info('Waiting 2 seconds before processing next batch...');
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      const processed = users.length;
      const successMessage = `Batch DUPR update completed: ${updated} updated, ${errors} errors out of ${processed} users processed ${
        leagueId ? 'in league ' + leagueId : ''
      }`;

      logger.info(successMessage);

      return {
        success: true,
        message: successMessage,
        processed,
        updated,
        errors,
        results,
      };
    } catch (error: any) {
      logger.error('Batch DUPR update failed:', error);
      return {
        success: false,
        message: 'Batch DUPR update failed due to server error',
        processed: 0,
        updated: 0,
        errors: 1,
        error: error.message || 'Unknown server error',
      };
    }
  }
}

export default new DuprPlayerService();
