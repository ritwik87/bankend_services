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

// DUPR Event Types - Based on official API schema
export interface EventMetadataV1 {
  metadata: Record<string, string>; // Additional metadata in key-value pairs
}

export interface EventDataV1 {
  name: string; // Event name (required)
  address: string; // Event address (required)
  registrationUrl: string; // Registration URL (required)
  minRating: number; // Minimum DUPR rating (required)
  maxRating: number; // Maximum DUPR rating (required)
  minAge: number; // Minimum age (required)
  maxAge: number; // Maximum age (required)
}

export interface EventTextV1 {
  text: Record<string, string>; // Text content in key-value pairs
}

export interface EventDatesV1 {
  startTime: string; // Event start time in ISO date-time format (required)
  endTime: string; // Event end time in ISO date-time format (required)
}

export interface EventV1 {
  metadata: EventMetadataV1; // Event metadata (required)
  data: EventDataV1; // Event data (required)
  text: EventTextV1; // Event text content (required)
  date: EventDatesV1; // Event dates (required)
}

export interface DuprEventCreateRequest {
  event: EventV1; // Event object (required)
}

export interface DuprEventUpdateRequest {
  events: Record<string, EventV1>; // Events object with event IDs as keys
}

export interface DuprEventDeleteRequest {
  eventIds: string[]; // Array of event IDs to delete
}

export interface DuprEventGetRequest {
  eventIds: string[]; // Array of event IDs to retrieve
}

export interface DuprEventResponse {
  success: boolean;
  eventId?: string;
  message?: string;
  error?: string;
  data?: any; // Response data from DUPR
}
