export interface UpdateEmailRequest {
  userId: string;
  newEmail: string;
  currentEmail: string;
}

export interface UpdateEmailResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface ValidateEmailRequest {
  email: string;
  excludeUserId?: string;
}

export interface ValidateEmailResponse {
  success: boolean;
  available: boolean;
  error?: string;
}