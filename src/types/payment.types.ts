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