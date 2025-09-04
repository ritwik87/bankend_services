/**
 * Auction Management Type Definitions
 * 
 * This file contains TypeScript interfaces and types for the IPL-style auction system
 */

export interface Auction {
  id: string;
  name: string;
  description?: string;
  tournament_id?: string;
  league_id?: string;
  status: 'upcoming' | 'active' | 'paused' | 'completed' | 'cancelled';
  current_player_id?: string;
  start_time?: string;
  end_time?: string;
  bid_increment: number;
  max_bid_time_seconds: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuctionPlayer {
  id: string;
  auction_id: string;
  player_id: string;
  is_sold: boolean;
  sold_to_team_id?: string;
  final_price: number;
  bidding_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Joined data
  player_name?: string;
  player_rating?: number;
  player_base_price?: number;
  player_image?: string;
  sold_to_team_name?: string;
  auction_name?: string;
  auction_status?: 'upcoming' | 'current' | 'sold' | 'completed';
}

export interface AuctionSettings {
  id: string;
  auction_id: string;
  max_players_per_team: number;
  min_players_per_team: number;
  salary_cap: number;
  bid_increment_amount: number;
  bid_time_limit_seconds: number;
  auto_bid_enabled: boolean;
  allow_bid_retraction: boolean;
  require_minimum_bid: boolean;
  created_at: string;
  updated_at: string;
}

export interface Bid {
  id: string;
  auction_id: string;
  player_id: string;
  team_id: string;
  bidder_id: string;
  amount: number;
  bid_time: string;
  is_winning_bid: boolean;
  created_at: string;
  
  // Joined data
  team_name?: string;
  bidder_name?: string;
  player_name?: string;
}

export interface TeamFunds {
  id: string;
  team_id: string;
  auction_id: string;
  initial_balance: number;
  used_balance: number;
  available_balance?: number; // computed field
  created_at: string;
  updated_at: string;
  
  // Joined data
  team_name?: string;
}

export interface PlayerPurchase {
  id: string;
  player_id: string;
  team_id: string;
  auction_id: string;
  purchase_amount: number;
  purchase_date: string;
  status: 'active' | 'released' | 'traded';
  created_at: string;
  updated_at: string;
  
  // Joined data
  player_name?: string;
  player_rating?: number;
  player_image?: string;
  team_name?: string;
  auction_name?: string;
}

export interface TeamTransaction {
  id: string;
  team_id: string;
  auction_id?: string;
  transaction_type: 'initial_allocation' | 'bid_placement' | 'player_purchase' | 'refund';
  amount: number;
  description?: string;
  created_at: string;
  
  // Joined data
  team_name?: string;
  auction_name?: string;
}

// Enhanced views
export interface AuctionStatusView {
  id: string;
  name: string;
  description?: string;
  tournament_id?: string;
  league_id?: string;
  status: string;
  current_player_id?: string;
  start_time?: string;
  end_time?: string;
  bid_increment: number;
  max_bid_time_seconds: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  
  // Current player info
  current_player_name?: string;
  current_player_base_price?: number;
  current_player_rating?: number;
  current_player_image?: string;
  current_player_order?: number;
  current_player_sold?: boolean;
  
  // Current bid info
  current_highest_bid?: number;
  leading_team_id?: string;
  leading_team_name?: string;
  leading_bidder_id?: string;
  leading_bidder_name?: string;
  last_bid_time?: string;
  
  // Stats
  total_players?: number;
  players_sold?: number;
  
  // Settings
  salary_cap?: number;
  max_players_per_team?: number;
  bid_time_limit_seconds?: number;
}

// API Request/Response types
export interface CreateAuctionRequest {
  name: string;
  description?: string;
  tournament_id?: string;
  league_id?: string;
  bid_increment?: number;
  max_bid_time_seconds?: number;
}

export interface UpdateAuctionRequest {
  name?: string;
  description?: string;
  status?: 'upcoming' | 'active' | 'paused' | 'completed' | 'cancelled';
  current_player_id?: string;
  start_time?: string;
  end_time?: string;
  bid_increment?: number;
  max_bid_time_seconds?: number;
}

export interface CreateAuctionSettingsRequest {
  auction_id: string;
  max_players_per_team?: number;
  min_players_per_team?: number;
  salary_cap?: number;
  bid_increment_amount?: number;
  bid_time_limit_seconds?: number;
  auto_bid_enabled?: boolean;
  allow_bid_retraction?: boolean;
  require_minimum_bid?: boolean;
}

export interface PlaceBidRequest {
  auction_id: string;
  player_id: string;
  team_id: string;
  amount: number;
}

export interface SetupAuctionPlayersRequest {
  auction_id: string;
  sport_id?: string;
}

export interface CompletePlayerAuctionRequest {
  auction_id: string;
  player_id: string;
  winning_team_id: string;
  final_price: number;
}

export interface BidValidationResult {
  is_valid: boolean;
  error_message?: string;
  current_highest: number;
  available_balance: number;
  required_increment: number;
  minimum_bid: number;
}

export interface PlaceBidResult {
  success: boolean;
  error?: string;
  bid_id?: string;
  amount?: number;
}

// Real-time event types
export interface AuctionRealtimeEvent {
  type: 'auction_status_change' | 'new_bid' | 'player_change' | 'auction_complete';
  auction_id: string;
  data: any;
  timestamp: string;
}

export interface BidRealtimeEvent {
  type: 'bid_placed' | 'bid_updated' | 'bid_cancelled';
  bid: Bid;
  auction_id: string;
  player_id: string;
  timestamp: string;
}

// Validation schemas
export interface AuctionValidationRules {
  name: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  bid_increment: {
    min: number;
    max: number;
  };
  max_bid_time_seconds: {
    min: number;
    max: number;
  };
}

// Error types
export interface AuctionError {
  code: string;
  message: string;
  details?: any;
}