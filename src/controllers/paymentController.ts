import { Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import {
  CreateOrderRequest,
  CreatePaymentLinkRequest,
  VerifyPaymentRequest,
  PaymentContext,
  CreateRefundRequest,
  FetchRefundRequest,
  FetchMultipleRefundsRequest
} from '../types/payment.types';
import logger from '../utils/logger';
import Joi from 'joi';

// Validation schemas
const createOrderSchema = Joi.object({
  amount: Joi.number().integer().min(100).required(),
  currency: Joi.string().length(3).default('INR'),
  receipt: Joi.string().max(40).optional(),
  notes: Joi.object().optional(),
  context: Joi.object({
    type: Joi.string().valid('tournament', 'league').required(),
    id: Joi.string().required(),
    category_id: Joi.string().optional(),
    category_ids: Joi.string().optional(),
    player_id: Joi.string().required(),
    partner_id: Joi.string().optional(),
    category_partners: Joi.string().optional(),
    custom_field_values: Joi.string().optional(),
    partner_custom_field_values: Joi.string().optional()
  }).required()
});

const verifyPaymentSchema = Joi.object({
  razorpay_order_id: Joi.string().required(),
  razorpay_payment_id: Joi.string().required(),
  razorpay_signature: Joi.string().required(),
  context: Joi.object({
    type: Joi.string().valid('tournament', 'league').required(),
    id: Joi.string().required(),
    category_id: Joi.string().optional(),
    category_ids: Joi.string().optional(),
    player_id: Joi.string().required(),
    partner_id: Joi.string().optional(),
    category_partners: Joi.string().optional(),
    custom_field_values: Joi.string().optional(),
    partner_custom_field_values: Joi.string().optional()
  }).required()
});

const verifyPaymentIdSchema = Joi.object({
  payment_id: Joi.string().required(),
  entity_type: Joi.string().valid('tournament', 'league').required(),
  entity_id: Joi.string().required()
});

const createPaymentLinkSchema = Joi.object({
  amount: Joi.number().integer().min(100).required(),
  currency: Joi.string().length(3).default('INR'),
  description: Joi.string().max(255).optional(),
  customer: Joi.object({
    name: Joi.string().max(100).optional(),
    email: Joi.string().email().optional(),
    contact: Joi.string().pattern(/^[0-9]{10}$/).optional()
  }).optional(),
  notify: Joi.object({
    sms: Joi.boolean().optional(),
    email: Joi.boolean().optional(),
    whatsapp: Joi.boolean().optional()
  }).optional(),
  reminder_enable: Joi.boolean().optional(),
  notes: Joi.object().optional(),
  callback_url: Joi.string().uri().optional(),
  callback_method: Joi.string().valid('get').optional(),
  expire_by: Joi.number().integer().min(Math.floor(Date.now() / 1000)).optional(),
  context: Joi.object({
    type: Joi.string().valid('tournament', 'league').required(),
    id: Joi.string().required(),
    category_id: Joi.string().optional(),
    category_ids: Joi.string().optional(),
    player_id: Joi.string().required(),
    partner_id: Joi.string().optional(),
    category_partners: Joi.string().optional(),
    custom_field_values: Joi.string().optional(),
    partner_custom_field_values: Joi.string().optional()
  }).required()
});

const validateCredentialsSchema = Joi.object({
  razorpay_key: Joi.string().required(),
  razorpay_secret: Joi.string().required()
});

const fetchTransactionsSchema = Joi.object({
  type: Joi.string().valid('tournament', 'league').required(),
  id: Joi.string().required(),
  from: Joi.number().integer().optional(),
  to: Joi.number().integer().optional(),
  count: Joi.number().integer().min(1).max(100).default(10),
  skip: Joi.number().integer().min(0).default(0)
});

const organizerTransactionsSchema = Joi.object({
  organizerId: Joi.string().required()
});

const createRefundSchema = Joi.object({
  payment_id: Joi.string().required(),
  amount: Joi.number().integer().min(1).optional(),
  speed: Joi.string().valid('normal', 'optimum').optional(), // Made optional, not default
  notes: Joi.object().optional(),
  receipt: Joi.string().max(40).optional(),
  context: Joi.object({
    type: Joi.string().valid('tournament', 'league').required(),
    id: Joi.string().required()
  }).required()
});

const fetchRefundSchema = Joi.object({
  refund_id: Joi.string().required(),
  context: Joi.object({
    type: Joi.string().valid('tournament', 'league').required(),
    id: Joi.string().required()
  }).required()
});

const fetchMultipleRefundsSchema = Joi.object({
  payment_id: Joi.string().required(),
  context: Joi.object({
    type: Joi.string().valid('tournament', 'league').required(),
    id: Joi.string().required()
  }).required(),
  count: Joi.number().integer().min(1).max(100).default(10),
  skip: Joi.number().integer().min(0).default(0),
  from: Joi.number().integer().optional(),
  to: Joi.number().integer().optional()
});

export class PaymentController {
  /**
   * Create a new Razorpay order
   */
  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = createOrderSchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const orderData: CreateOrderRequest = value;

      // Log the order creation attempt (without sensitive data)
      logger.info('Creating payment order:', {
        amount: orderData.amount,
        currency: orderData.currency,
        context: {
          type: orderData.context.type,
          id: orderData.context.id,
          player_id: orderData.context.player_id
        }
      });

      const result = await paymentService.createOrder(orderData);

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in createOrder controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Create a new Razorpay payment link (only for default payment type)
   */
  async createPaymentLink(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = createPaymentLinkSchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const paymentLinkData: CreatePaymentLinkRequest = value;

      // Log the payment link creation attempt (without sensitive data)
      logger.info('Creating payment link:', {
        amount: paymentLinkData.amount,
        currency: paymentLinkData.currency,
        context: {
          type: paymentLinkData.context.type,
          id: paymentLinkData.context.id,
          player_id: paymentLinkData.context.player_id
        }
      });

      const result = await paymentService.createPaymentLink(paymentLinkData);

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in createPaymentLink controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Verify payment signature
   */
  async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = verifyPaymentSchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          verified: false,
          error: error.details[0].message
        });
        return;
      }

      const verificationData: VerifyPaymentRequest = value;

      // Log the verification attempt
      logger.info('Verifying payment:', {
        orderId: verificationData.razorpay_order_id,
        paymentId: verificationData.razorpay_payment_id,
        context: {
          type: verificationData.context.type,
          id: verificationData.context.id,
          player_id: verificationData.context.player_id
        }
      });

      const result = await paymentService.verifyPayment(verificationData);

      if (result.success) {
        if (result.verified) {
          res.status(200).json(result);
        } else {
          res.status(400).json(result);
        }
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      logger.error('Error in verifyPayment controller:', error);
      res.status(500).json({
        success: false,
        verified: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Validate Razorpay credentials
   */
  async validateCredentials(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = validateCredentialsSchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          valid: false,
          error: error.details[0].message
        });
        return;
      }

      const { razorpay_key, razorpay_secret } = value;

      logger.info('Validating Razorpay credentials');

      const isValid = await paymentService.validateCredentials({
        key: razorpay_key,
        secret: razorpay_secret
      });

      res.status(200).json({
        success: true,
        valid: isValid
      });

    } catch (error) {
      logger.error('Error in validateCredentials controller:', error);
      res.status(500).json({
        success: false,
        valid: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Health check for payment service
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Payment service is healthy',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Fetch payments for a specific tournament or league
   */
  async fetchPayments(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = fetchTransactionsSchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const context = value;

      logger.info('Fetching payments:', {
        type: context.type,
        id: context.id,
        count: context.count,
        skip: context.skip
      });

      const result = await paymentService.fetchPayments(context);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in fetchPayments controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Fetch orders for a specific tournament or league
   */
  async fetchOrders(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = fetchTransactionsSchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const context = value;

      logger.info('Fetching orders:', {
        type: context.type,
        id: context.id,
        count: context.count,
        skip: context.skip
      });

      const result = await paymentService.fetchOrders(context);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in fetchOrders controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Fetch refunds for a specific tournament or league
   */
  async fetchRefunds(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = fetchTransactionsSchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const context = value;

      logger.info('Fetching refunds:', {
        type: context.type,
        id: context.id,
        count: context.count,
        skip: context.skip
      });

      const result = await paymentService.fetchRefunds(context);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in fetchRefunds controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get transaction summary for a specific tournament or league
   */
  async getTransactionSummary(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = fetchTransactionsSchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const context = value;

      logger.info('Fetching transaction summary:', {
        type: context.type,
        id: context.id
      });

      const result = await paymentService.getTransactionSummary(context);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in getTransactionSummary controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get aggregated transactions for organizer dashboard
   */
  async getOrganizerTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = organizerTransactionsSchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const { organizerId } = value;

      logger.info('Fetching organizer transactions:', { organizerId });

      const result = await paymentService.getOrganizerTransactions(organizerId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in getOrganizerTransactions controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get aggregated transactions for admin dashboard
   */
  async getRazorpayTransactionsByNotes(req: Request, res: Response): Promise<void> {
    try {
      const { tournament_id, league_id } = req.query as {
        tournament_id?: string;
        league_id?: string;
      };

      if (!tournament_id && !league_id) {
        res.status(400).json({
          success: false,
          error: 'Either tournament_id or league_id query parameter is required',
        });
        return;
      }

      const context = tournament_id
        ? { type: 'tournament' as const, id: tournament_id }
        : { type: 'league' as const, id: league_id! };

      logger.info('Fetching Razorpay transactions by notes', context);

      const result = await paymentService.fetchTransactionsByNotes(context);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in getRazorpayTransactionsByNotes controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  async getMissingRegistrations(req: Request, res: Response): Promise<void> {
    try {
      const { tournament_id, league_id } = req.query as { tournament_id?: string; league_id?: string };

      if (!tournament_id && !league_id) {
        res.status(400).json({ success: false, error: 'Either tournament_id or league_id query parameter is required' });
        return;
      }

      const context = tournament_id
        ? { type: 'tournament' as const, id: tournament_id }
        : { type: 'league' as const, id: league_id! };

      logger.info('Fetching missing registrations', context);

      const result = await paymentService.fetchMissingRegistrations(context);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in getMissingRegistrations controller:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getAdminTransactions(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Fetching admin transactions');

      const result = await paymentService.getAdminTransactions();

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in getAdminTransactions controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Verify payment ID exists and get payment details
   */
  async verifyPaymentId(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = verifyPaymentIdSchema.validate(req.body);

      if (error) {
        logger.error('Validation error in verifyPaymentId:', error.details);
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      logger.info('Verifying payment ID:', { payment_id: value.payment_id, entity_type: value.entity_type });

      const result = await paymentService.verifyPaymentId(value);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in verifyPaymentId controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Create organizer payment order (for tournament/league creation)
   */
  async createOrganizerOrder(req: Request, res: Response): Promise<void> {
    try {
      const createOrganizerOrderSchema = Joi.object({
        amount: Joi.number().positive().required(),
        currency: Joi.string().length(3).default('INR'),
        receipt: Joi.string().max(40).optional(),
        notes: Joi.object().optional(),
        context: Joi.object({
          type: Joi.string().valid('tournament', 'league').required(),
          organizer_id: Joi.string().required(),
          entity_name: Joi.string().required(),
        }).required(),
      });

      const { error, value } = createOrganizerOrderSchema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
        return;
      }

      logger.info('Creating organizer payment order:', {
        amount: value.amount,
        type: value.context.type,
        organizer_id: value.context.organizer_id,
      });

      const result = await paymentService.createOrganizerOrder(value);

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      logger.error('Error in createOrganizerOrder controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Verify organizer payment
   */
  async verifyOrganizerPayment(req: Request, res: Response): Promise<void> {
    try {
      const verifyOrganizerPaymentSchema = Joi.object({
        razorpay_order_id: Joi.string().required(),
        razorpay_payment_id: Joi.string().required(),
        razorpay_signature: Joi.string().required(),
        context: Joi.object({
          type: Joi.string().valid('tournament', 'league').required(),
          organizer_id: Joi.string().required(),
        }).required(),
      });

      const { error, value } = verifyOrganizerPaymentSchema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          verified: false,
          error: error.details[0].message,
        });
        return;
      }

      logger.info('Verifying organizer payment:', {
        payment_id: value.razorpay_payment_id,
        type: value.context.type,
        entity_id: value.context.entity_id,
      });

      const result = await paymentService.verifyOrganizerPayment(value);

      if (result.success) {
        if (result.verified) {
          res.status(200).json(result);
        } else {
          res.status(400).json(result);
        }
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      logger.error('Error in verifyOrganizerPayment controller:', error);
      res.status(500).json({
        success: false,
        verified: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Create a refund for a payment (Admin only)
   */
  async createRefund(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = createRefundSchema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const refundData: CreateRefundRequest = value;

      logger.info('Creating refund:', {
        payment_id: refundData.payment_id,
        amount: refundData.amount,
        context: refundData.context
      });

      const result = await paymentService.createRefund(refundData);

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in createRefund controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Fetch a specific refund by ID (Admin only)
   */
  async fetchRefund(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = fetchRefundSchema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const refundRequest: FetchRefundRequest = value;

      logger.info('Fetching refund:', {
        refund_id: refundRequest.refund_id,
        context: refundRequest.context
      });

      const result = await paymentService.fetchRefund(refundRequest);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in fetchRefund controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Fetch multiple refunds for a payment (Admin only)
   */
  async fetchMultipleRefundsForPayment(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = fetchMultipleRefundsSchema.validate(req.body);

      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message
        });
        return;
      }

      const refundsRequest: FetchMultipleRefundsRequest = value;

      logger.info('Fetching refunds for payment:', {
        payment_id: refundsRequest.payment_id,
        context: refundsRequest.context
      });

      const result = await paymentService.fetchMultipleRefundsForPayment(refundsRequest);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Error in fetchMultipleRefundsForPayment controller:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export const paymentController = new PaymentController();