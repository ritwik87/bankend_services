export interface DuprAuthToken {
  status: string;
  created_at: number;
  result: TokenResult;
}

interface TokenResult {
  token: string;
  expiry: string;
}

export interface DuprPlayer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  duprId: string;
  singlesRating?: number;
  doublesRating?: number;
  reliability?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DuprValidationRequest {
  duprId: string;
  email?: string;
  phone?: string;
}

export interface DuprValidationResponse {
  isValid: boolean;
  player?: DuprPlayer;
  error?: string;
}

export interface DuprRatingResponse {
  duprId: string;
  singlesRating?: number;
  doublesRating?: number;
  reliability?: number;
  lastUpdated: string;
}

export interface DuprLookupResponse {
  email: string;
  duprId: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DuprApiError {
  code: string;
  message: string;
  details?: any;
}

// DUPR Match Upload Types - Based on official API schema
export interface DuprMatchTeam {
  player1: string; // DUPR ID of player 1
  player2?: string; // DUPR ID of player 2 (for doubles)
  game1: number; // Team's Game 1 score
  game2?: number; // Team's Game 2 score
  game3?: number; // Team's Game 3 score
  game4?: number; // Team's Game 4 score
  game5?: number; // Team's Game 5 score
}

export interface DuprMatchUploadRequest {
  location?: string; // Match location
  matchDate: string; // Match date in ISO 8061 format (yyyy-MM-dd)
  teamA: DuprMatchTeam;
  teamB: DuprMatchTeam;
  format: 'SINGLES' | 'DOUBLES'; // Match format
  event: string; // Event name (required)
  bracket?: string; // Bracket name
  matchType?: 'SIDEOUT' | 'RALLY'; // Match type
  identifier: string; // Unique identifier for this match (required)
  clubId?: number; // DUPR Club unique identifier
  extras?: Record<string, string>; // Extra parameters in key-value pairs
  matchSource?: 'DUPR' | 'LEAGUE' | 'PARTNER' | 'CLUB'; // Source of the match
}

export interface DuprMatchUpdateRequest {
  matchId: number; // Match ID to update
  location?: string;
  matchDate: string;
  teamA: DuprMatchTeam;
  teamB: DuprMatchTeam;
  format: 'SINGLES' | 'DOUBLES';
  event: string;
  bracket?: string;
  matchType?: 'SIDEOUT' | 'RALLY';
  identifier: string;
  clubId?: number;
  extras?: Record<string, string>;
  matchSource?: 'DUPR' | 'LEAGUE' | 'PARTNER' | 'CLUB';
}

export interface DuprMatchUploadResponse {
  success: boolean;
  matchId?: string;
  matchCode?: string;
  message?: string;
  error?: string;
}

export interface DuprBatchUploadResponse {
  successful: number;
  failed: number;
  results: DuprMatchUploadResponse[];
}
