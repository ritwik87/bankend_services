import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
  CreateOrderRequest,
  CreateOrderResponse,
  CreatePaymentLinkRequest,
  CreatePaymentLinkResponse,
  RazorpayCredentials,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from '../types/payment.types';
import logger from '../utils/logger';
import { whatsappService } from './whatsapp.service';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export class PaymentService {
  /**
   * Fetch Razorpay credentials from database using context
   */
  private async fetchCredentials(context: {
    type: 'tournament' | 'league';
    id: string;
  }): Promise<(RazorpayCredentials & { isDefault: boolean }) | null> {
    try {
      const tableName =
        context.type === 'tournament' ? 'tournaments' : 'leagues';

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
      const razorpaySecret =
        data?.razorpay_secret || process.env.RAZORPAY_SECRET;
      const isDefault = !data?.razorpay_key; // True if using default credentials

      if (!razorpayKey || !razorpaySecret) {
        logger.error(
          `No Razorpay credentials found for ${context.type} ${context.id} and no default credentials available`
        );
        return null;
      }

      logger.info(
        `Using ${isDefault ? 'default' : 'custom'} Razorpay credentials for ${
          context.type
        } ${context.id}`
      );

      return {
        key: razorpayKey,
        secret: razorpaySecret,
        isDefault,
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
      const auth = Buffer.from(
        `${credentials.key}:${credentials.secret}`
      ).toString('base64');

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

        // Create registration record and send WhatsApp notifications
        try {
          await this.createRegistrationAndSendNotifications(
            context,
            paymentDetails,
            razorpay_payment_id
          );
        } catch (notificationError) {
          // Log notification errors but don't fail the payment verification
          logger.error(
            'Error creating registration or sending WhatsApp notifications:',
            notificationError
          );
        }

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
   * Create registration record and send WhatsApp notifications
   */
  private async createRegistrationAndSendNotifications(
    context: {
      type: 'tournament' | 'league';
      id: string;
      player_id: string;
      category_id?: string;
      category_ids?: string;
      partner_id?: string;
      category_partners?: string;
    },
    paymentDetails: any,
    paymentId: string
  ): Promise<void> {
    try {
      // Step 1: Create registration record first
      const registrationId = await this.createRegistrationRecord(
        context,
        paymentId
      );

      // Step 2: Get tournament/league information
      const tableName =
        context.type === 'tournament' ? 'tournaments' : 'leagues';

      const { data: entityData, error: entityError } = await supabase
        .from(tableName)
        .select('name, description, organizer_id')
        .eq('id', context.id)
        .single();

      if (entityError || !entityData) {
        logger.error(
          `Failed to fetch ${context.type} data for notifications:`,
          entityError
        );
        return;
      }

      // Step 3: Get organizer information separately
      const { data: organizerData, error: organizerError } = await supabase
        .from('profiles')
        .select('name, phone')
        .eq('id', entityData.organizer_id)
        .single();

      if (organizerError || !organizerData) {
        logger.error(
          'Failed to fetch organizer data for notifications:',
          organizerError
        );
        return;
      }

      // Step 4: Get player information
      const { data: playerData, error: playerError } = await supabase
        .from('profiles')
        .select('name, phone, email')
        .eq('id', context.player_id)
        .single();

      if (playerError || !playerData) {
        logger.error(
          'Failed to fetch player data for notifications:',
          playerError
        );
        return;
      }

      // Format phone numbers
      const playerPhone = whatsappService.formatPhoneNumber(
        playerData.phone || ''
      );
      const organizerPhone = whatsappService.formatPhoneNumber(
        organizerData.phone || ''
      );

      // Validate phone numbers
      if (!whatsappService.isValidPhoneNumber(playerPhone)) {
        logger.warn(
          `Invalid player phone number for WhatsApp: ${playerData.phone}`
        );
      } else {
        // Send booking confirmation to player
        const currentDate = new Date().toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        await whatsappService.sendBookingConfirmationToUser(
          playerPhone,
          playerData.name || 'Player',
          entityData.name || `${context.type}`,
          currentDate,
          registrationId
        );

        logger.info(`Booking confirmation sent to player: ${playerData.name}`);
      }

      // Send notification to organizer
      if (!whatsappService.isValidPhoneNumber(organizerPhone)) {
        logger.warn(
          `Invalid organizer phone number for WhatsApp: ${organizerData.phone}`
        );
      } else {
        const currentDate = new Date().toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        await whatsappService.sendManagerNotification(
          organizerPhone,
          playerData.name || 'Player',
          playerPhone || '9999999999',
          entityData.name || `${context.type}`,
          currentDate,
          registrationId
        );

        logger.info(
          `Manager notification sent to organizer: ${organizerData.name}`
        );
      }
    } catch (error) {
      logger.error('Error in createRegistrationAndSendNotifications:', error);
      throw error;
    }
  }

  /**
   * Create registration record in the database
   */
  private async createRegistrationRecord(
    context: {
      type: 'tournament' | 'league';
      id: string;
      player_id: string;
      category_id?: string;
      category_ids?: string;
      partner_id?: string;
      category_partners?: string;
    },
    paymentId: string
  ): Promise<string> {
    try {
      if (context.type === 'league') {
        // Create league registration
        const { data, error } = await supabase
          .from('league_registrations')
          .insert({
            league_id: context.id,
            player_id: context.player_id,
            status: 'confirmed',
            payment_status: 'paid',
            payment_id: paymentId,
          })
          .select('id')
          .single();

        if (error) {
          logger.error('Failed to create league registration:', error);
          throw error;
        }

        logger.info(`League registration created with ID: ${data.id}`);
        return data.id;
      } else {
        // For tournaments, handle multiple categories with their partners
        const categoryIds = context.category_ids
          ? context.category_ids.split(',')
          : context.category_id
          ? [context.category_id]
          : [];
        const categoryPartnersMap = context.category_partners
          ? JSON.parse(context.category_partners)
          : {};

        if (categoryIds.length === 0) {
          // Fallback for legacy single category without specific category
          const registrationData: any = {
            tournament_id: context.id,
            player_id: context.player_id,
            status: 'approved',
            payment_status: 'paid',
            payment_id: paymentId,
          };

          if (context.partner_id) {
            registrationData.partner_id = context.partner_id;
          }

          const { data, error } = await supabase
            .from('tournament_registrations')
            .insert(registrationData)
            .select('id')
            .single();

          if (error) {
            logger.error('Failed to create tournament registration:', error);
            throw error;
          }

          logger.info(`Tournament registration created with ID: ${data.id}`);
          return data.id;
        }

        // Create multiple registrations for each category
        const registrationsToInsert = categoryIds.map((categoryId) => {
          const registrationData: any = {
            tournament_id: context.id,
            player_id: context.player_id,
            category_id: categoryId,
            status: 'approved',
            payment_status: 'paid',
            payment_id: paymentId,
          };

          // Add partner_id for this specific category if provided
          if (categoryPartnersMap[categoryId]) {
            registrationData.partner_id = categoryPartnersMap[categoryId];
          }

          return registrationData;
        });

        const { data, error } = await supabase
          .from('tournament_registrations')
          .insert(registrationsToInsert)
          .select('id');

        if (error) {
          logger.error('Failed to create tournament registrations:', error);
          throw error;
        }

        const registrationIds = data.map((reg) => reg.id);
        logger.info(
          `Tournament registrations created with IDs: ${registrationIds.join(
            ', '
          )}`
        );

        // Return the first registration ID for WhatsApp notifications
        return registrationIds[0];
      }
    } catch (error) {
      logger.error('Error creating registration record:', error);
      throw error;
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
   * Create a Razorpay payment link (only for default payment type)
   */
  async createPaymentLink(
    paymentLinkData: CreatePaymentLinkRequest
  ): Promise<CreatePaymentLinkResponse> {
    try {
      const { context, ...linkParams } = paymentLinkData;

      // Fetch credentials from database using context
      const credentials = await this.fetchCredentials(context);

      if (!credentials) {
        return {
          success: false,
          error: 'Unable to retrieve Razorpay credentials',
        };
      }

      // Only create payment links for default payment type
      if (!credentials.isDefault) {
        return {
          success: false,
          error:
            'Payment links are only supported with default Razorpay configuration',
        };
      }

      // Create authorization header with default credentials
      const auth = Buffer.from(
        `${credentials.key}:${credentials.secret}`
      ).toString('base64');

      const response = await fetch(
        'https://api.razorpay.com/v1/payment_links',
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(linkParams),
        }
      );

      if (!response.ok) {
        const errorData: any = await response.json();
        logger.error('Failed to create Razorpay payment link:', errorData);
        return {
          success: false,
          error:
            errorData.error?.description || 'Failed to create payment link',
        };
      }

      const paymentLink: any = await response.json();

      logger.info('Razorpay payment link created successfully:', {
        linkId: paymentLink.id,
        shortUrl: paymentLink.short_url,
      });

      return {
        success: true,
        paymentLink,
      };
    } catch (error) {
      logger.error('Error creating Razorpay payment link:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
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

  /**
   * Fetch payments by specific payment IDs from database registrations
   */
  async fetchPaymentsByIds(context: {
    type: 'tournament' | 'league';
    id: string;
  }): Promise<any> {
    try {
      const credentials = await this.fetchCredentials({
        type: context.type,
        id: context.id,
      });

      if (!credentials) {
        return {
          success: false,
          error: 'Unable to retrieve Razorpay credentials',
        };
      }

      // Get payment IDs from database registrations
      const tableName = context.type === 'tournament' ? 'tournament_registrations' : 'league_registrations';
      const idColumn = context.type === 'tournament' ? 'tournament_id' : 'league_id';

      const { data: registrations, error: dbError } = await supabase
        .from(tableName)
        .select('payment_id')
        .eq(idColumn, context.id)
        .not('payment_id', 'is', null);

      if (dbError) {
        logger.error(`Failed to fetch ${context.type} registrations:`, dbError);
        return {
          success: false,
          error: `Failed to fetch ${context.type} registrations`,
        };
      }

      const paymentIds = registrations?.map(reg => reg.payment_id).filter(Boolean) || [];

      if (paymentIds.length === 0) {
        return {
          success: true,
          items: [],
          count: 0,
          total_count: 0,
        };
      }

      // Fetch each payment individually from Razorpay
      const auth = Buffer.from(
        `${credentials.key}:${credentials.secret}`
      ).toString('base64');

      const paymentPromises = paymentIds.map(async (paymentId) => {
        try {
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

          if (response.ok) {
            return await response.json();
          } else {
            logger.warn(`Failed to fetch payment ${paymentId}:`, response.status);
            return null;
          }
        } catch (error) {
          logger.warn(`Error fetching payment ${paymentId}:`, error);
          return null;
        }
      });

      const payments = (await Promise.all(paymentPromises)).filter(Boolean);

      return {
        success: true,
        items: payments,
        count: payments.length,
        total_count: paymentIds.length,
        missing_payments: paymentIds.length - payments.length,
      };
    } catch (error) {
      logger.error('Error fetching payments by IDs:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Fetch all payments for a specific tournament or league (Legacy method - uses metadata filtering)
   */
  async fetchPayments(context: {
    type: 'tournament' | 'league';
    id: string;
    from?: number;
    to?: number;
    count?: number;
    skip?: number;
  }): Promise<any> {
    try {
      const credentials = await this.fetchCredentials({
        type: context.type,
        id: context.id,
      });

      if (!credentials) {
        return {
          success: false,
          error: 'Unable to retrieve Razorpay credentials',
        };
      }

      const auth = Buffer.from(
        `${credentials.key}:${credentials.secret}`
      ).toString('base64');

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (context.count) queryParams.append('count', context.count.toString());
      if (context.skip) queryParams.append('skip', context.skip.toString());
      if (context.from) queryParams.append('from', context.from.toString());
      if (context.to) queryParams.append('to', context.to.toString());

      const response = await fetch(
        `https://api.razorpay.com/v1/payments?${queryParams}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData: any = await response.json();
        logger.error('Failed to fetch payments:', errorData);
        return {
          success: false,
          error: errorData.error?.description || 'Failed to fetch payments',
        };
      }

      const data: any = await response.json();

      // Filter payments by entity ID (check notes, receipt, order description)
      const filteredPayments =
        data.items?.filter((payment: any) => {
          const notes = payment.notes || {};
          const description = payment.description || '';
          const orderId = payment.order_id || '';

          return (
            notes[`${context.type}_id`] === context.id ||
            notes.entity_id === context.id ||
            notes.entity_type === context.type ||
            description.includes(context.id) ||
            orderId.includes(context.id)
          );
        }) || [];

      return {
        success: true,
        items: filteredPayments,
        count: filteredPayments.length,
        total_count: data.count,
      };
    } catch (error) {
      logger.error('Error fetching payments:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Fetch all orders for a specific tournament or league
   */
  async fetchOrders(context: {
    type: 'tournament' | 'league';
    id: string;
    from?: number;
    to?: number;
    count?: number;
    skip?: number;
  }): Promise<any> {
    try {
      const credentials = await this.fetchCredentials({
        type: context.type,
        id: context.id,
      });

      if (!credentials) {
        return {
          success: false,
          error: 'Unable to retrieve Razorpay credentials',
        };
      }

      const auth = Buffer.from(
        `${credentials.key}:${credentials.secret}`
      ).toString('base64');

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (context.count) queryParams.append('count', context.count.toString());
      if (context.skip) queryParams.append('skip', context.skip.toString());
      if (context.from) queryParams.append('from', context.from.toString());
      if (context.to) queryParams.append('to', context.to.toString());

      const response = await fetch(
        `https://api.razorpay.com/v1/orders?${queryParams}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData: any = await response.json();
        logger.error('Failed to fetch orders:', errorData);
        return {
          success: false,
          error: errorData.error?.description || 'Failed to fetch orders',
        };
      }

      const data: any = await response.json();

      // Filter orders by entity ID (check notes, receipt)
      const filteredOrders =
        data.items?.filter((order: any) => {
          const notes = order.notes || {};
          const receipt = order.receipt || '';

          return (
            notes[`${context.type}_id`] === context.id ||
            notes.entity_id === context.id ||
            notes.entity_type === context.type ||
            receipt.includes(context.id)
          );
        }) || [];

      return {
        success: true,
        items: filteredOrders,
        count: filteredOrders.length,
        total_count: data.count,
      };
    } catch (error) {
      logger.error('Error fetching orders:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Fetch refunds for a specific tournament or league
   */
  async fetchRefunds(context: {
    type: 'tournament' | 'league';
    id: string;
    from?: number;
    to?: number;
    count?: number;
    skip?: number;
  }): Promise<any> {
    try {
      const credentials = await this.fetchCredentials({
        type: context.type,
        id: context.id,
      });

      if (!credentials) {
        return {
          success: false,
          error: 'Unable to retrieve Razorpay credentials',
        };
      }

      const auth = Buffer.from(
        `${credentials.key}:${credentials.secret}`
      ).toString('base64');

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (context.count) queryParams.append('count', context.count.toString());
      if (context.skip) queryParams.append('skip', context.skip.toString());
      if (context.from) queryParams.append('from', context.from.toString());
      if (context.to) queryParams.append('to', context.to.toString());

      const response = await fetch(
        `https://api.razorpay.com/v1/refunds?${queryParams}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData: any = await response.json();
        logger.error('Failed to fetch refunds:', errorData);
        return {
          success: false,
          error: errorData.error?.description || 'Failed to fetch refunds',
        };
      }

      const data: any = await response.json();

      // Filter refunds by entity ID (check notes)
      const filteredRefunds =
        data.items?.filter((refund: any) => {
          const notes = refund.notes || {};

          return (
            notes[`${context.type}_id`] === context.id ||
            notes.entity_id === context.id ||
            notes.entity_type === context.type
          );
        }) || [];

      return {
        success: true,
        items: filteredRefunds,
        count: filteredRefunds.length,
        total_count: data.count,
      };
    } catch (error) {
      logger.error('Error fetching refunds:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get transaction summary/analytics for a tournament or league
   */
  async getTransactionSummary(context: {
    type: 'tournament' | 'league';
    id: string;
    from?: number;
    to?: number;
  }): Promise<any> {
    try {
      const [paymentsResult, refundsResult] = await Promise.all([
        this.fetchPaymentsByIds(context),
        this.fetchRefunds({ ...context, count: 100 }),
      ]);

      if (!paymentsResult.success) {
        return {
          success: false,
          error: paymentsResult.error,
        };
      }

      const payments = paymentsResult.items || [];
      const refunds = refundsResult.success ? refundsResult.items || [] : [];

      // Calculate summary statistics
      let totalAmount = 0;
      let successfulTransactions = 0;
      let failedTransactions = 0;
      let authorizedAmount = 0;
      let capturedAmount = 0;
      let refundedAmount = 0;

      payments.forEach((payment: any) => {
        const amount = payment.amount || 0;

        switch (payment.status) {
          case 'captured':
            capturedAmount += amount;
            successfulTransactions++;
            break;
          case 'authorized':
            authorizedAmount += amount;
            break;
          case 'failed':
            failedTransactions++;
            break;
        }
      });

      refunds.forEach((refund: any) => {
        refundedAmount += refund.amount || 0;
      });

      totalAmount = capturedAmount + authorizedAmount;

      // Process individual payment details for UI display
      const paymentDetails = payments.map((payment: any) => {
        const amount = payment.amount || 0;
        const amountInRupees = amount / 100; // Convert from paisa to rupees
        const razorpayFee = amountInRupees * 0.02; // 2% Razorpay fee
        const gst = razorpayFee * 0.18; // 18% GST on fee
        const cgst = gst / 2; // CGST is half of total GST
        const sgst = gst / 2; // SGST is half of total GST
        const totalFee = razorpayFee + gst;
        const netAmount = amountInRupees - totalFee;

        return {
          payment_id: payment.id,
          created_date: payment.created_at ? new Date(payment.created_at * 1000).toISOString().split('T')[0] : null,
          registration_amount: amountInRupees,
          razorpay_fee: razorpayFee,
          cgst: cgst,
          sgst: sgst,
          net_amount: netAmount,
          status: payment.status,
          currency: 'INR'
        };
      });

      return {
        success: true,
        summary: {
          total_amount: totalAmount / 100, // Convert from paisa to rupees
          captured_amount: capturedAmount / 100,
          authorized_amount: authorizedAmount / 100,
          refunded_amount: refundedAmount / 100,
          total_transactions: payments.length,
          successful_transactions: successfulTransactions,
          failed_transactions: failedTransactions,
          refund_count: refunds.length,
          currency: 'INR',
        },
        payment_details: paymentDetails, // Add individual payment details
      };
    } catch (error) {
      logger.error('Error generating transaction summary:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get aggregated transaction data for organizer dashboard
   */
  async getOrganizerTransactions(organizerId: string): Promise<any> {
    try {
      // Fetch all tournaments and leagues for the organizer
      const [tournamentsResult, leaguesResult] = await Promise.all([
        supabase
          .from('tournaments')
          .select('id, name, razorpay_key, razorpay_secret')
          .eq('organizer_id', organizerId),
        supabase
          .from('leagues')
          .select('id, name, razorpay_key, razorpay_secret')
          .eq('organizer_id', organizerId),
      ]);

      if (tournamentsResult.error || leaguesResult.error) {
        return {
          success: false,
          error: 'Failed to fetch organizer entities',
        };
      }

      const tournaments = tournamentsResult.data || [];
      const leagues = leaguesResult.data || [];

      // Fetch transaction summaries for all entities
      const summaryPromises = [
        ...tournaments.map((tournament: any) =>
          this.getTransactionSummary({
            type: 'tournament',
            id: tournament.id,
          }).then((result) => ({
            ...result,
            entityType: 'tournament',
            entityName: tournament.name,
            entityId: tournament.id,
          }))
        ),
        ...leagues.map((league: any) =>
          this.getTransactionSummary({ type: 'league', id: league.id }).then(
            (result) => ({
              ...result,
              entityType: 'league',
              entityName: league.name,
              entityId: league.id,
            })
          )
        ),
      ];

      const summaries = await Promise.all(summaryPromises);

      // Aggregate all successful summaries
      const validSummaries = summaries.filter((s) => s.success);
      const failedSummaries = summaries.filter((s) => !s.success);

      // Calculate overall totals
      let overallTotalAmount = 0;
      let overallTotalTransactions = 0;
      let overallSuccessfulTransactions = 0;
      let overallFailedTransactions = 0;
      let overallRefundedAmount = 0;

      validSummaries.forEach((summary: any) => {
        if (summary.summary) {
          overallTotalAmount += summary.summary.total_amount;
          overallTotalTransactions += summary.summary.total_transactions;
          overallSuccessfulTransactions +=
            summary.summary.successful_transactions;
          overallFailedTransactions += summary.summary.failed_transactions;
          overallRefundedAmount += summary.summary.refunded_amount;
        }
      });

      return {
        success: true,
        overall_summary: {
          total_amount: overallTotalAmount,
          total_transactions: overallTotalTransactions,
          successful_transactions: overallSuccessfulTransactions,
          failed_transactions: overallFailedTransactions,
          refunded_amount: overallRefundedAmount,
          currency: 'INR',
        },
        entity_summaries: validSummaries.map((s: any) => ({
          entity_type: s.entityType,
          entity_name: s.entityName,
          entity_id: s.entityId,
          summary: s.summary,
          payment_details: s.payment_details || [], // Include individual payment details
        })),
        errors: failedSummaries.length > 0 ? failedSummaries : null,
      };
    } catch (error) {
      logger.error('Error fetching organizer transactions:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get aggregated transaction data for admin dashboard
   */
  async getAdminTransactions(): Promise<any> {
    try {
      // Fetch all tournaments and leagues with default credentials only
      const [tournamentsResult, leaguesResult] = await Promise.all([
        supabase
          .from('tournaments')
          .select('id, name, organizer_id')
          .or('razorpay_key.is.null,razorpay_secret.is.null'),
        supabase
          .from('leagues')
          .select('id, name, organizer_id')
          .or('razorpay_key.is.null,razorpay_secret.is.null'),
      ]);

      if (tournamentsResult.error || leaguesResult.error) {
        return {
          success: false,
          error: 'Failed to fetch entities for admin dashboard',
        };
      }

      const tournaments = tournamentsResult.data || [];
      const leagues = leaguesResult.data || [];

      // Only process entities that use default credentials
      const summaryPromises = [
        ...tournaments.map((tournament: any) =>
          this.getTransactionSummary({
            type: 'tournament',
            id: tournament.id,
          }).then((result) => ({
            ...result,
            entityType: 'tournament',
            entityName: tournament.name,
            entityId: tournament.id,
            organizerId: tournament.organizerId,
          }))
        ),
        ...leagues.map((league: any) =>
          this.getTransactionSummary({ type: 'league', id: league.id }).then(
            (result) => ({
              ...result,
              entityType: 'league',
              entityName: league.name,
              entityId: league.id,
              organizerId: league.organizerId,
            })
          )
        ),
      ];

      const summaries = await Promise.all(summaryPromises);

      // Aggregate all successful summaries
      const validSummaries = summaries.filter((s) => s.success);

      // Calculate overall totals
      let overallTotalAmount = 0;
      let overallTotalTransactions = 0;
      let overallSuccessfulTransactions = 0;
      let overallFailedTransactions = 0;
      let overallRefundedAmount = 0;

      validSummaries.forEach((summary: any) => {
        if (summary.summary) {
          overallTotalAmount += summary.summary.total_amount;
          overallTotalTransactions += summary.summary.total_transactions;
          overallSuccessfulTransactions +=
            summary.summary.successful_transactions;
          overallFailedTransactions += summary.summary.failed_transactions;
          overallRefundedAmount += summary.summary.refunded_amount;
        }
      });

      return {
        success: true,
        overall_summary: {
          total_amount: overallTotalAmount,
          total_transactions: overallTotalTransactions,
          successful_transactions: overallSuccessfulTransactions,
          failed_transactions: overallFailedTransactions,
          refunded_amount: overallRefundedAmount,
          currency: 'INR',
        },
        entity_summaries: validSummaries.map((s: any) => ({
          entity_type: s.entityType,
          entity_name: s.entityName,
          entity_id: s.entityId,
          organizer_id: s.organizerId,
          summary: s.summary,
          payment_details: s.payment_details || [], // Include individual payment details
        })),
      };
    } catch (error) {
      logger.error('Error fetching admin transactions:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

export const paymentService = new PaymentService();
