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
  category_id?: string; // For backward compatibility
  category_ids?: string; // Comma-separated category IDs for multiple categories
  player_id: string;
  partner_id?: string; // For backward compatibility
  category_partners?: string; // JSON string of category->partner mapping
  custom_field_values?: string; // JSON string of custom field values for player
  partner_custom_field_values?: string; // JSON string of partner custom field values per category
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

export interface CreateRefundRequest {
  payment_id: string; // Payment ID to refund
  amount?: number; // Amount to refund in paisa (optional for full refund)
  speed?: 'normal' | 'optimum'; // Refund speed (normal or optimum)
  notes?: Record<string, string>;
  receipt?: string;
  context: {
    type: 'tournament' | 'league';
    id: string;
  };
}

export interface CreateRefundResponse {
  success: boolean;
  refund?: {
    id: string;
    entity: string;
    amount: number;
    currency: string;
    payment_id: string;
    notes?: Record<string, string>;
    receipt?: string | null;
    acquirer_data?: any;
    created_at: number;
    batch_id?: string | null;
    status: string;
    speed_processed: string;
    speed_requested: string;
  };
  error?: string;
}

export interface FetchRefundRequest {
  refund_id: string;
  context: {
    type: 'tournament' | 'league';
    id: string;
  };
}

export interface FetchRefundResponse {
  success: boolean;
  refund?: any;
  error?: string;
}

export interface FetchMultipleRefundsRequest {
  payment_id: string; // Fetch refunds for a specific payment
  context: {
    type: 'tournament' | 'league';
    id: string;
  };
  count?: number;
  skip?: number;
  from?: number;
  to?: number;
}