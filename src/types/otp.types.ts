// OTP related types and interfaces

export interface GenerateOtpRequest {
  phone: string;
}

export interface GenerateOtpResponse {
  success: boolean;
  message: string;
  userExists: boolean;
  error?: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  userExists: boolean;
  user?: {
    id: string;
    role: string;
    name: string;
    email: string;
    phone: string;
    organization_name?: string;
    organization_description?: string;
    experience?: string;
  };
  session?: any;
  error?: string;
}

export interface CompleteRegistrationRequest {
  phone: string;
  userData: {
    name: string;
    email: string;
    role: 'player' | 'organizer';
    organizationName?: string;
    organizationDescription?: string;
    experience?: string;
  };
}

export interface CompleteRegistrationResponse {
  success: boolean;
  user?: any;
  message: string;
  error?: string;
}

export interface WhatsAppResponse {
  success: boolean;
  message?: string;
}

// Database OTP record
export interface OtpRecord {
  id: string;
  user_id: string;
  phone: string;
  otp_code: string;
  expiry_time: string;
  is_used: boolean;
  created_at: string;
}

// User profile for OTP context
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  organization_name?: string;
  organization_description?: string;
  experience?: string;
  created_at: string;
  updated_at: string;
}