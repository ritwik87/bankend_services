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
