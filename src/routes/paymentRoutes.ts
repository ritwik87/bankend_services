import { Router } from 'express';
import { paymentController } from '../controllers/paymentController';
import { duprApiLimiter as rateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateOrderRequest:
 *       type: object
 *       required:
 *         - amount
 *         - razorpay_key
 *         - razorpay_secret
 *         - context
 *       properties:
 *         amount:
 *           type: number
 *           minimum: 100
 *           description: Amount in paisa (smallest currency unit)
 *           example: 50000
 *         currency:
 *           type: string
 *           default: INR
 *           example: INR
 *         receipt:
 *           type: string
 *           maxLength: 40
 *           example: tournament_reg_001
 *         notes:
 *           type: object
 *           additionalProperties:
 *             type: string
 *         razorpay_key:
 *           type: string
 *           example: rzp_test_1234567890
 *         razorpay_secret:
 *           type: string
 *           example: secret_1234567890
 *         context:
 *           type: object
 *           required:
 *             - type
 *             - id
 *             - player_id
 *           properties:
 *             type:
 *               type: string
 *               enum: [tournament, league]
 *             id:
 *               type: string
 *               description: Tournament or League ID
 *             category_id:
 *               type: string
 *               description: Category ID (for tournaments)
 *             player_id:
 *               type: string
 *               description: Player ID making the payment
 *
 *     VerifyPaymentRequest:
 *       type: object
 *       required:
 *         - razorpay_order_id
 *         - razorpay_payment_id
 *         - razorpay_signature
 *         - razorpay_key
 *         - razorpay_secret
 *         - context
 *       properties:
 *         razorpay_order_id:
 *           type: string
 *           example: order_1234567890
 *         razorpay_payment_id:
 *           type: string
 *           example: pay_1234567890
 *         razorpay_signature:
 *           type: string
 *           example: signature_hash_here
 *         razorpay_key:
 *           type: string
 *           example: rzp_test_1234567890
 *         razorpay_secret:
 *           type: string
 *           example: secret_1234567890
 *         context:
 *           $ref: '#/components/schemas/CreateOrderRequest/properties/context'
 */

/**
 * @swagger
 * /api/payment/create-payment-link:
 *   post:
 *     summary: Create a new Razorpay payment link (only for default payment type)
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - context
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 100
 *                 description: Amount in paisa (smallest currency unit)
 *                 example: 50000
 *               currency:
 *                 type: string
 *                 default: INR
 *                 example: INR
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 example: Tournament Registration Payment
 *               customer:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     maxLength: 100
 *                     example: John Doe
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: john@example.com
 *                   contact:
 *                     type: string
 *                     pattern: '^[0-9]{10}$'
 *                     example: 9876543210
 *               notify:
 *                 type: object
 *                 properties:
 *                   sms:
 *                     type: boolean
 *                     default: false
 *                   email:
 *                     type: boolean
 *                     default: false
 *                   whatsapp:
 *                     type: boolean
 *                     default: false
 *               reminder_enable:
 *                 type: boolean
 *                 default: true
 *               notes:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *               callback_url:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/payment-success
 *               callback_method:
 *                 type: string
 *                 enum: [get]
 *               expire_by:
 *                 type: number
 *                 description: Unix timestamp when link expires
 *               context:
 *                 type: object
 *                 required:
 *                   - type
 *                   - id
 *                   - player_id
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [tournament, league]
 *                   id:
 *                     type: string
 *                     description: Tournament or League ID
 *                   category_id:
 *                     type: string
 *                     description: Category ID (for tournaments)
 *                   player_id:
 *                     type: string
 *                     description: Player ID making the payment
 *     responses:
 *       201:
 *         description: Payment link created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 paymentLink:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     short_url:
 *                       type: string
 *                       description: The payment link URL
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Bad request - validation error, not default payment type, or creation failed
 *       500:
 *         description: Internal server error
 */
router.post('/create-payment-link', rateLimiter, paymentController.createPaymentLink);

/**
 * @swagger
 * /api/payment/create-order:
 *   post:
 *     summary: Create a new Razorpay order
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderRequest'
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Bad request - validation error or order creation failed
 *       500:
 *         description: Internal server error
 */
router.post('/create-order', rateLimiter, paymentController.createOrder);

/**
 * @swagger
 * /api/payment/verify:
 *   post:
 *     summary: Verify Razorpay payment signature
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyPaymentRequest'
 *     responses:
 *       200:
 *         description: Payment verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 verified:
 *                   type: boolean
 *                 payment_details:
 *                   type: object
 *                   description: Payment details from Razorpay API
 *       400:
 *         description: Bad request - validation error or verification failed
 *       500:
 *         description: Internal server error
 */
router.post('/verify', rateLimiter, paymentController.verifyPayment);

/**
 * @swagger
 * /api/payment/validate-credentials:
 *   post:
 *     summary: Validate Razorpay credentials
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - razorpay_key
 *               - razorpay_secret
 *             properties:
 *               razorpay_key:
 *                 type: string
 *               razorpay_secret:
 *                 type: string
 *     responses:
 *       200:
 *         description: Credential validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 valid:
 *                   type: boolean
 */
router.post(
  '/validate-credentials',
  rateLimiter,
  paymentController.validateCredentials
);

/**
 * @swagger
 * /api/payment/health:
 *   get:
 *     summary: Payment service health check
 *     tags: [Payment]
 *     responses:
 *       200:
 *         description: Service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 */
router.get('/health', paymentController.healthCheck);

export default router;
