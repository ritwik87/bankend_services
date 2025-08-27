import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger';
import {
  CreateOrderRequest,
  CreateOrderResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  RazorpayCredentials,
} from '../types/payment.types';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export class PaymentService {
  /**
   * Fetch Razorpay credentials from database using context
   */
  private async fetchCredentials(
    context: { type: 'tournament' | 'league'; id: string }
  ): Promise<RazorpayCredentials | null> {
    try {
      const tableName = context.type === 'tournament' ? 'tournaments' : 'leagues';
      
      const { data, error } = await supabase
        .from(tableName)
        .select('razorpay_key, razorpay_secret')
        .eq('id', context.id)
        .single();

      if (error) {
        logger.error(`Failed to fetch ${context.type} credentials:`, error);
        return null;
      }

      // Use custom credentials if available, otherwise fall back to default environment variables
      const razorpayKey = data?.razorpay_key || process.env.RAZORPAY_KEY;
      const razorpaySecret = data?.razorpay_secret || process.env.RAZORPAY_SECRET;

      if (!razorpayKey || !razorpaySecret) {
        logger.error(`No Razorpay credentials found for ${context.type} ${context.id} and no default credentials available`);
        return null;
      }

      logger.info(`Using ${data?.razorpay_key ? 'custom' : 'default'} Razorpay credentials for ${context.type} ${context.id}`);

      return {
        key: razorpayKey,
        secret: razorpaySecret,
      };
    } catch (error) {
      logger.error('Error fetching credentials:', error);
      return null;
    }
  }

  /**
   * Create a Razorpay order using credentials fetched from database
   */
  async createOrder(
    orderData: CreateOrderRequest
  ): Promise<CreateOrderResponse> {
    try {
      const { context, ...orderParams } = orderData;

      // Fetch credentials from database using context
      const credentials = await this.fetchCredentials(context);
      
      if (!credentials) {
        return {
          success: false,
          error: 'Unable to retrieve Razorpay credentials',
        };
      }

      // Create authorization header with fetched credentials
      const auth = Buffer.from(`${credentials.key}:${credentials.secret}`).toString(
        'base64'
      );

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderParams),
      });

      if (!response.ok) {
        const errorData: any = await response.json();
        logger.error('Failed to create Razorpay order:', errorData);
        return {
          success: false,
          error: errorData.error?.description || 'Failed to create order',
        };
      }

      const order: any = await response.json();

      logger.info('Razorpay order created successfully:', {
        orderId: order.id,
      });

      return {
        success: true,
        order,
      };
    } catch (error) {
      logger.error('Error creating Razorpay order:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Verify Razorpay payment signature using credentials from database
   */
  async verifyPayment(
    verificationData: VerifyPaymentRequest
  ): Promise<VerifyPaymentResponse> {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        context,
      } = verificationData;

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !context
      ) {
        return {
          success: false,
          verified: false,
          error: 'Missing required payment verification parameters',
        };
      }

      // Fetch credentials from database using context
      const credentials = await this.fetchCredentials(context);
      
      if (!credentials) {
        return {
          success: false,
          verified: false,
          error: 'Unable to retrieve Razorpay credentials',
        };
      }

      // Generate expected signature using fetched credentials
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', credentials.secret)
        .update(body.toString())
        .digest('hex');

      const isSignatureValid = expectedSignature === razorpay_signature;

      if (isSignatureValid) {
        // Fetch payment details from Razorpay API
        const paymentDetails = await this.fetchPaymentDetails(
          razorpay_payment_id,
          credentials
        );

        logger.info('Payment signature verified successfully:', {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
        });

        return {
          success: true,
          verified: true,
          payment_details: paymentDetails,
        };
      } else {
        logger.warn('Payment signature verification failed:', {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
        });

        return {
          success: true,
          verified: false,
          error: 'Invalid payment signature',
        };
      }
    } catch (error) {
      logger.error('Error verifying payment:', error);
      return {
        success: false,
        verified: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Fetch payment details from Razorpay API
   */
  private async fetchPaymentDetails(
    paymentId: string,
    credentials: RazorpayCredentials
  ): Promise<any> {
    try {
      const auth = Buffer.from(
        `${credentials.key}:${credentials.secret}`
      ).toString('base64');

      const response = await fetch(
        `https://api.razorpay.com/v1/payments/${paymentId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Failed to fetch payment details:', errorData);
        return null;
      }

      return await response.json();
    } catch (error) {
      logger.error('Error fetching payment details:', error);
      return null;
    }
  }

  /**
   * Validate Razorpay credentials by making a test API call
   */
  async validateCredentials(
    credentials: RazorpayCredentials
  ): Promise<boolean> {
    try {
      const auth = Buffer.from(
        `${credentials.key}:${credentials.secret}`
      ).toString('base64');

      // Make a simple API call to validate credentials
      const response = await fetch(
        'https://api.razorpay.com/v1/orders?count=1',
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.ok;
    } catch (error) {
      logger.error('Error validating Razorpay credentials:', error);
      return false;
    }
  }
}

export const paymentService = new PaymentService();
