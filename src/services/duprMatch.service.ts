import {
  DuprBatchUploadResponse,
  DuprMatchUploadRequest,
  DuprMatchUploadResponse,
} from '../types/dupr.types';
import logger from '../utils/logger';
import duprAuthService from './duprAuth.service';

class DuprMatchService {
  private readonly apiVersion = 'v1.0';
  private readonly clubId?: number;

  constructor() {
    // Load club ID from environment variable
    const clubIdEnv = process.env.DUPR_CLUB_ID;
    this.clubId = clubIdEnv ? parseInt(clubIdEnv, 10) : undefined;
  }

  /**
   * Upload a single match to DUPR
   */
  async uploadMatch(
    matchData: DuprMatchUploadRequest
  ): Promise<DuprMatchUploadResponse> {
    try {
      // Validate match data
      this.validateMatchData(matchData);

      // Add club ID if available and not already set
      const dataWithClubId = {
        ...matchData,
        clubId: matchData.clubId || this.clubId,
      };

      // Make authenticated request to DUPR
      const response = await duprAuthService.makeAuthenticatedRequest(
        `/match/${this.apiVersion}/create`,
        'POST',
        dataWithClubId
      );

      logger.info('DUPR match upload successful', {
        identifier: matchData.identifier,
        matchCode: response.data?.result?.matchCode,
      });

      return {
        success: true,
        matchCode: response.data?.result?.matchCode,
        message: 'Match uploaded successfully to DUPR',
      };
    } catch (error: any) {
      logger.error('DUPR match upload failed', {
        identifier: matchData.identifier,
        error: error.message,
        response: error.response?.data,
      });

      return {
        success: false,
        error:
          error.response?.data?.message || error.message || 'Upload failed',
        message: 'Failed to upload match to DUPR',
      };
    }
  }

  /**
   * Upload multiple matches to DUPR in batch
   */
  async uploadMatches(
    matches: DuprMatchUploadRequest[]
  ): Promise<DuprBatchUploadResponse> {
    try {
      // Validate all matches
      matches.forEach((match) => this.validateMatchData(match));

      // Add club ID to all matches if available and not already set
      const matchesWithClubId = matches.map((match) => ({
        ...match,
        clubId: match.clubId || this.clubId,
      }));

      // Make authenticated request to DUPR batch endpoint
      const response = await duprAuthService.makeAuthenticatedRequest(
        `/match/${this.apiVersion}/batch`,
        'POST',
        matchesWithClubId
      );

      const results: DuprMatchUploadResponse[] = [];
      const responseData = response.data;

      // Process batch response
      if (responseData && Array.isArray(responseData.result?.matchCodes)) {
        for (let i = 0; i < matches.length; i++) {
          const result = responseData.result?.matchCodes[i];
          results.push({
            success: !!result?.matchCode,
            matchId: result?.matchId,
            matchCode: result?.matchCode,
            message: result?.matchCode ? 'Success' : 'Failed',
            error: result?.error,
          });
        }
      } else {
        // If no detailed results, assume all succeeded based on response status
        matches.forEach((match, index) => {
          results.push({
            success: true,
            matchId: `batch-${index}`,
            message: 'Batch upload successful',
          });
        });
      }

      const successful = results.filter((r) => r.success).length;
      const failed = results.length - successful;

      logger.info('DUPR batch upload completed', {
        total: matches.length,
        successful,
        failed,
      });

      return {
        successful,
        failed,
        results,
      };
    } catch (error: any) {
      logger.error('DUPR batch upload failed', {
        matchCount: matches.length,
        error: error.message,
        response: error.response?.data,
      });

      // Return failed results for all matches
      const results: DuprMatchUploadResponse[] = matches.map((match) => ({
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          'Batch upload failed',
        message: 'Failed to upload match in batch',
      }));

      return {
        successful: 0,
        failed: matches.length,
        results,
      };
    }
  }

  /**
   * Update an existing match in DUPR
   */
  async updateMatch(
    matchId: number,
    matchData: DuprMatchUploadRequest
  ): Promise<DuprMatchUploadResponse> {
    try {
      const updateData = {
        ...matchData,
        matchId,
        clubId: matchData.clubId || this.clubId,
      };

      const response = await duprAuthService.makeAuthenticatedRequest(
        `/match/${this.apiVersion}/update`,
        'POST',
        updateData
      );

      logger.info('DUPR match update successful', {
        matchId,
        identifier: matchData.identifier,
      });

      return {
        success: true,
        matchId: matchId.toString(),
        message: 'Match updated successfully in DUPR',
      };
    } catch (error: any) {
      logger.error('DUPR match update failed', {
        matchId,
        identifier: matchData.identifier,
        error: error.message,
      });

      return {
        success: false,
        error:
          error.response?.data?.message || error.message || 'Update failed',
        message: 'Failed to update match in DUPR',
      };
    }
  }

  /**
   * Delete a match from DUPR
   */
  async deleteMatch(
    matchCode: string,
    identifier: string
  ): Promise<DuprMatchUploadResponse> {
    try {
      const deleteData = {
        matchCode,
        identifier,
      };

      await duprAuthService.makeAuthenticatedRequest(
        `/match/${this.apiVersion}/delete`,
        'DELETE',
        deleteData
      );

      logger.info('DUPR match deletion successful', {
        matchCode,
        identifier,
      });

      return {
        success: true,
        message: 'Match deleted successfully from DUPR',
      };
    } catch (error: any) {
      logger.error('DUPR match deletion failed', {
        matchCode,
        identifier,
        error: error.message,
      });

      return {
        success: false,
        error:
          error.response?.data?.message || error.message || 'Deletion failed',
        message: 'Failed to delete match from DUPR',
      };
    }
  }

  /**
   * Get match information from DUPR by match ID
   */
  async getMatchInfo(matchId: string): Promise<any> {
    try {
      const response = await duprAuthService.makeAuthenticatedRequest(
        `/match/${this.apiVersion}/${matchId}`,
        'GET'
      );

      logger.info('DUPR match info retrieved successfully', {
        matchId,
      });

      return {
        success: true,
        data: response.data,
        message: 'Match information retrieved successfully',
      };
    } catch (error: any) {
      logger.error('DUPR match info retrieval failed', {
        matchId,
        error: error.message,
      });

      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          'Failed to retrieve match info',
        message: 'Failed to retrieve match information from DUPR',
      };
    }
  }

  /**
   * Validate match data before sending to DUPR
   */
  private validateMatchData(matchData: DuprMatchUploadRequest): void {
    const errors: string[] = [];

    // Required fields
    if (!matchData.event) errors.push('Event name is required');
    if (!matchData.identifier) errors.push('Match identifier is required');
    if (!matchData.matchDate) errors.push('Match date is required');
    if (!matchData.format) errors.push('Match format is required');
    if (!matchData.teamA) errors.push('Team A is required');
    if (!matchData.teamB) errors.push('Team B is required');

    // Team validation
    if (matchData.teamA) {
      if (!matchData.teamA.player1) errors.push('Team A player 1 is required');
      if (typeof matchData.teamA.game1 !== 'number')
        errors.push('Team A game 1 score is required');

      if (matchData.format === 'DOUBLES' && !matchData.teamA.player2) {
        errors.push('Team A player 2 is required for doubles matches');
      }
    }

    if (matchData.teamB) {
      if (!matchData.teamB.player1) errors.push('Team B player 1 is required');
      if (typeof matchData.teamB.game1 !== 'number')
        errors.push('Team B game 1 score is required');

      if (matchData.format === 'DOUBLES' && !matchData.teamB.player2) {
        errors.push('Team B player 2 is required for doubles matches');
      }
    }

    // Date format validation
    if (matchData.matchDate && !this.isValidDateFormat(matchData.matchDate)) {
      errors.push('Match date must be in ISO format (yyyy-MM-dd)');
    }

    // Score validation - ensure there's a winner
    if (matchData.teamA && matchData.teamB) {
      const teamATotal =
        (matchData.teamA.game1 || 0) +
        (matchData.teamA.game2 || 0) +
        (matchData.teamA.game3 || 0) +
        (matchData.teamA.game4 || 0) +
        (matchData.teamA.game5 || 0);
      const teamBTotal =
        (matchData.teamB.game1 || 0) +
        (matchData.teamB.game2 || 0) +
        (matchData.teamB.game3 || 0) +
        (matchData.teamB.game4 || 0) +
        (matchData.teamB.game5 || 0);

      if (teamATotal === teamBTotal) {
        errors.push('Matches cannot be tied - there must be a clear winner');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Match validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Validate date format (yyyy-MM-dd)
   */
  private isValidDateFormat(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;

    const date = new Date(dateString + 'T00:00:00Z');
    return date.toISOString().startsWith(dateString);
  }

  /**
   * Convert internal match data to DUPR format
   * Helper method to transform match data from internal format to DUPR API format
   */
  convertToMatchUploadRequest(
    internalMatch: any,
    tournamentName: string,
    matchDate: string
  ): DuprMatchUploadRequest {
    return {
      event: tournamentName,
      matchDate: matchDate, // yyyy-MM-dd format
      identifier: `match-${internalMatch.id}-${Date.now()}`, // Unique identifier
      format: internalMatch.match_type === 'singles' ? 'SINGLES' : 'DOUBLES',
      location: internalMatch.location || '',
      clubId: this.clubId, // Add club ID from environment
      teamA: {
        player1: internalMatch.team1_player1?.dupr_id || '',
        player2: internalMatch.team1_player2?.dupr_id,
        game1: internalMatch.team1_score || 0,
      },
      teamB: {
        player1: internalMatch.team2_player1?.dupr_id || '',
        player2: internalMatch.team2_player2?.dupr_id,
        game1: internalMatch.team2_score || 0,
      },
      matchType: 'SIDEOUT', // Default to sideout, could be configurable
      matchSource: 'PARTNER', // Default source for partner integrations
      extras: {
        internal_match_id: internalMatch.id,
        tournament_id: internalMatch.tournament_id,
        category_id: internalMatch.category_id,
      },
    };
  }
}

export default new DuprMatchService();
