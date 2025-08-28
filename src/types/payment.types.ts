export interface RazorpayCredentials {
  key: string;
  secret: string;
}

export interface CreateOrderRequest {
  amount: number; // Amount in paisa (smallest currency unit)
  currency: string; // e.g., 'INR'
  receipt?: string;
  notes?: Record<string, string>;
  context: PaymentContext;
}

export interface CreateOrderResponse {
  success: boolean;
  order?: {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt: string | null;
    status: string;
    created_at: number;
    notes: Record<string, string>;
  };
  error?: string;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  context: PaymentContext;
}

export interface VerifyPaymentResponse {
  success: boolean;
  verified: boolean;
  error?: string;
  payment_details?: any;
}

export interface PaymentContext {
  type: 'tournament' | 'league';
  id: string;
  category_id?: string;
  player_id: string;
}

export interface CreatePaymentLinkRequest {
  amount: number; // Amount in paisa (smallest currency unit)
  currency: string; // e.g., 'INR'
  description?: string;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notify?: {
    sms?: boolean;
    email?: boolean;
    whatsapp?: boolean;
  };
  reminder_enable?: boolean;
  notes?: Record<string, string>;
  callback_url?: string;
  callback_method?: string;
  expire_by?: number; // Unix timestamp
  context: PaymentContext;
}

export interface CreatePaymentLinkResponse {
  success: boolean;
  paymentLink?: {
    id: string;
    amount: number;
    amount_paid: number;
    cancelled_at: number;
    created_at: number;
    currency: string;
    customer?: {
      contact?: string;
      email?: string;
      name?: string;
    };
    description?: string;
    expire_by?: number;
    expired_at?: number;
    first_min_partial_amount?: number;
    notes?: Record<string, string>;
    notify?: {
      email?: boolean;
      sms?: boolean;
      whatsapp?: boolean;
    };
    payments?: any[];
    reference_id?: string;
    reminder_enable?: boolean;
    reminders?: any[];
    short_url?: string;
    status: string;
    updated_at?: number;
    upi_link?: boolean;
    user_id?: string;
    whatsapp_link?: boolean;
  };
  error?: string;
}