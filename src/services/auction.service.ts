/**
 * Auction Service
 *
 * Service layer for auction management operations
 */

import {
  Auction,
  AuctionPlayer,
  AuctionSettings,
  AuctionStatusView,
  Bid,
  BidValidationResult,
  CompletePlayerAuctionRequest,
  CreateAuctionRequest,
  CreateAuctionSettingsRequest,
  PlaceBidRequest,
  PlaceBidResult,
  PlayerPurchase,
  SetupAuctionPlayersRequest,
  TeamFunds,
  UpdateAuctionRequest,
} from '../types/auction.types';
import logger from '../utils/logger';
import { supabase } from '../utils/supabase';

class AuctionService {
  /**
   * Get all auctions
   */
  async getAuctions(): Promise<Auction[]> {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching auctions:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('AuctionService.getAuctions error:', error);
      throw error;
    }
  }

  /**
   * Get auction by ID with enhanced status
   */
  async getAuctionById(auctionId: string): Promise<AuctionStatusView | null> {
    try {
      const { data, error } = await supabase
        .from('auction_status_enhanced_view')
        .select('*')
        .eq('id', auctionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        logger.error('Error fetching auction by ID:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('AuctionService.getAuctionById error:', error);
      throw error;
    }
  }

  /**
   * Create new auction
   */
  async createAuction(
    userId: string,
    auctionData: CreateAuctionRequest
  ): Promise<Auction> {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .insert({
          ...auctionData,
          created_by: userId,
          status: 'upcoming',
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating auction:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('AuctionService.createAuction error:', error);
      throw error;
    }
  }

  /**
   * Update auction
   */
  async updateAuction(
    auctionId: string,
    updateData: UpdateAuctionRequest
  ): Promise<Auction> {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .update(updateData)
        .eq('id', auctionId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating auction:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('AuctionService.updateAuction error:', error);
      throw error;
    }
  }

  /**
   * Delete auction
   */
  async deleteAuction(auctionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('auctions')
        .delete()
        .eq('id', auctionId);

      if (error) {
        logger.error('Error deleting auction:', error);
        throw error;
      }
    } catch (error) {
      logger.error('AuctionService.deleteAuction error:', error);
      throw error;
    }
  }

  /**
   * Setup auction players
   */
  async setupAuctionPlayers(
    request: SetupAuctionPlayersRequest
  ): Promise<{ count: number }> {
    try {
      const { data, error } = await supabase.rpc('setup_auction_players', {
        auction_id_param: request.auction_id,
        sport_id_param: request.sport_id || null,
      });

      if (error) {
        logger.error('Error setting up auction players:', error);
        throw error;
      }

      return { count: data || 0 };
    } catch (error) {
      logger.error('AuctionService.setupAuctionPlayers error:', error);
      throw error;
    }
  }

  /**
   * Get auction players
   */
  async getAuctionPlayers(auctionId: string): Promise<AuctionPlayer[]> {
    try {
      const { data, error } = await supabase
        .from('auction_players_view')
        .select('*')
        .eq('auction_id', auctionId)
        .order('bidding_order');

      if (error) {
        logger.error('Error fetching auction players:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('AuctionService.getAuctionPlayers error:', error);
      throw error;
    }
  }

  /**
   * Start auction
   */
  async startAuction(auctionId: string): Promise<Auction> {
    try {
      // Get the first player
      const firstPlayer = await supabase.rpc('get_next_auction_player', {
        auction_id_param: auctionId,
      });

      const { data, error } = await supabase
        .from('auctions')
        .update({
          status: 'active',
          start_time: new Date().toISOString(),
          current_player_id: firstPlayer.data,
        })
        .eq('id', auctionId)
        .select()
        .single();

      if (error) {
        logger.error('Error starting auction:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('AuctionService.startAuction error:', error);
      throw error;
    }
  }

  /**
   * Pause auction
   */
  async pauseAuction(auctionId: string): Promise<Auction> {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .update({ status: 'paused' })
        .eq('id', auctionId)
        .select()
        .single();

      if (error) {
        logger.error('Error pausing auction:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('AuctionService.pauseAuction error:', error);
      throw error;
    }
  }

  /**
   * Resume auction
   */
  async resumeAuction(auctionId: string): Promise<Auction> {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .update({ status: 'active' })
        .eq('id', auctionId)
        .select()
        .single();

      if (error) {
        logger.error('Error resuming auction:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('AuctionService.resumeAuction error:', error);
      throw error;
    }
  }

  /**
   * Move to next player
   */
  async nextPlayer(auctionId: string): Promise<Auction> {
    try {
      const nextPlayerId = await supabase.rpc('get_next_auction_player', {
        auction_id_param: auctionId,
      });

      const updateData: any = { current_player_id: nextPlayerId.data };

      // If no next player, complete the auction
      if (!nextPlayerId.data) {
        updateData.status = 'completed';
        updateData.end_time = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('auctions')
        .update(updateData)
        .eq('id', auctionId)
        .select()
        .single();

      if (error) {
        logger.error('Error moving to next player:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('AuctionService.nextPlayer error:', error);
      throw error;
    }
  }

  /**
   * Complete auction
   */
  async completeAuction(auctionId: string): Promise<Auction> {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
        })
        .eq('id', auctionId)
        .select()
        .single();

      if (error) {
        logger.error('Error completing auction:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('AuctionService.completeAuction error:', error);
      throw error;
    }
  }

  /**
   * Validate bid
   */
  async validateBid(request: PlaceBidRequest): Promise<BidValidationResult> {
    try {
      const { data, error } = await supabase.rpc('validate_bid', {
        auction_id_param: request.auction_id,
        team_id_param: request.team_id,
        player_id_param: request.player_id,
        bid_amount_param: request.amount,
      });

      if (error) {
        logger.error('Error validating bid:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('AuctionService.validateBid error:', error);
      throw error;
    }
  }

  /**
   * Place bid
   */
  async placeBid(
    userId: string,
    request: PlaceBidRequest
  ): Promise<PlaceBidResult> {
    try {
      const { data, error } = await supabase.rpc('place_bid', {
        auction_id_param: request.auction_id,
        player_id_param: request.player_id,
        team_id_param: request.team_id,
        bidder_id_param: userId,
        amount_param: request.amount,
      });

      if (error) {
        logger.error('Error placing bid:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('AuctionService.placeBid error:', error);
      throw error;
    }
  }

  /**
   * Get bids for auction/player
   */
  async getBids(auctionId: string, playerId?: string): Promise<Bid[]> {
    try {
      let query = supabase
        .from('bids')
        .select(
          `
        *,
        league_teams:team_id(name),
        bidder:bidder_id(name),
        player:player_id(name)
        `
        )
        .eq('auction_id', auctionId)
        .order('bid_time', { ascending: false });

      if (playerId) {
        query = query.eq('player_id', playerId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching bids:', error);
        throw error;
      }

      // Transform the data
      return (data || []).map((bid: any) => ({
        ...bid,
        team_name: bid.league_teams?.name,
        bidder_name: bid.profiles?.name,
        player_name: bid.auction_players?.profiles?.name,
      }));
    } catch (error) {
      logger.error('AuctionService.getBids error:', error);
      throw error;
    }
  }

  /**
   * Complete player auction (sell to highest bidder)
   */
  async completePlayerAuction(
    request: CompletePlayerAuctionRequest
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('complete_player_auction', {
        auction_id_param: request.auction_id,
        player_id_param: request.player_id,
        winning_team_id: request.winning_team_id,
        final_price_param: request.final_price,
      });

      if (error) {
        logger.error('Error completing player auction:', error);
        throw error;
      }

      return data || false;
    } catch (error) {
      logger.error('AuctionService.completePlayerAuction error:', error);
      throw error;
    }
  }

  /**
   * Get team funds for auction
   */
  async getTeamFunds(auctionId: string, teamId?: string): Promise<TeamFunds[]> {
    try {
      let query = supabase
        .from('team_funds')
        .select(
          `
          *,
          league_teams:team_id(name)
        `
        )
        .eq('auction_id', auctionId);

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching team funds:', error);
        throw error;
      }

      return (data || []).map((fund: any) => ({
        ...fund,
        team_name: fund.league_teams?.name,
      }));
    } catch (error) {
      logger.error('AuctionService.getTeamFunds error:', error);
      throw error;
    }
  }

  /**
   * Get auction settings
   */
  async getAuctionSettings(auctionId: string): Promise<AuctionSettings | null> {
    try {
      const { data, error } = await supabase
        .from('auction_settings')
        .select('*')
        .eq('auction_id', auctionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        logger.error('Error fetching auction settings:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('AuctionService.getAuctionSettings error:', error);
      throw error;
    }
  }

  /**
   * Create or update auction settings
   */
  async upsertAuctionSettings(
    settingsData: CreateAuctionSettingsRequest
  ): Promise<AuctionSettings> {
    try {
      const { data, error } = await supabase
        .from('auction_settings')
        .upsert(settingsData, { onConflict: 'auction_id' })
        .select()
        .single();

      if (error) {
        logger.error('Error upserting auction settings:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('AuctionService.upsertAuctionSettings error:', error);
      throw error;
    }
  }

  /**
   * Get player purchases (final roster)
   */
  async getPlayerPurchases(
    auctionId: string,
    teamId?: string
  ): Promise<PlayerPurchase[]> {
    try {
      let query = supabase
        .from('team_roster_view')
        .select('*')
        .eq('auction_id', auctionId);

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching player purchases:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('AuctionService.getPlayerPurchases error:', error);
      throw error;
    }
  }
}

export default new AuctionService();
