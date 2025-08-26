import express from 'express';
import { otpController } from '../controllers/otpController';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     GenerateOtpRequest:
 *       type: object
 *       required:
 *         - phone
 *       properties:
 *         phone:
 *           type: string
 *           description: Phone number without country code (10 digits)
 *           example: "9876543210"
 *           pattern: "^[0-9]{10}$"
 *     
 *     VerifyOtpRequest:
 *       type: object
 *       required:
 *         - phone
 *         - otp
 *       properties:
 *         phone:
 *           type: string
 *           description: Phone number without country code (10 digits)
 *           example: "9876543210"
 *           pattern: "^[0-9]{10}$"
 *         otp:
 *           type: string
 *           description: 6-digit OTP code
 *           example: "123456"
 *           pattern: "^[0-9]{6}$"
 *     
 *     CompleteRegistrationRequest:
 *       type: object
 *       required:
 *         - phone
 *         - userData
 *       properties:
 *         phone:
 *           type: string
 *           description: Phone number without country code (10 digits)
 *           example: "9876543210"
 *           pattern: "^[0-9]{10}$"
 *         userData:
 *           type: object
 *           required:
 *             - name
 *             - email
 *             - role
 *           properties:
 *             name:
 *               type: string
 *               minLength: 2
 *               example: "John Doe"
 *             email:
 *               type: string
 *               format: email
 *               example: "john@example.com"
 *             role:
 *               type: string
 *               enum: [player, organizer]
 *               example: "player"
 *             organizationName:
 *               type: string
 *               minLength: 2
 *               example: "Sports Club"
 *             organizationDescription:
 *               type: string
 *               minLength: 10
 *               example: "Local sports organization"
 *             experience:
 *               type: string
 *               minLength: 5
 *               example: "5 years of tournament organization"
 *     
 *     GenerateOtpResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "OTP sent successfully via WhatsApp"
 *         userExists:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: "Error message if failed"
 *     
 *     VerifyOtpResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         userExists:
 *           type: boolean
 *           example: true
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "uuid-string"
 *             role:
 *               type: string
 *               example: "player"
 *             name:
 *               type: string
 *               example: "John Doe"
 *             email:
 *               type: string
 *               example: "john@example.com"
 *             phone:
 *               type: string
 *               example: "9876543210"
 *         session:
 *           type: object
 *           nullable: true
 *         error:
 *           type: string
 *           example: "Error message if failed"
 */

/**
 * @swagger
 * /api/otp/generate:
 *   post:
 *     summary: Generate and send OTP via WhatsApp
 *     tags: [OTP Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GenerateOtpRequest'
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GenerateOtpResponse'
 *       400:
 *         description: Bad request - validation error or failed to send OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GenerateOtpResponse'
 *       500:
 *         description: Internal server error
 */
router.post('/generate', otpController.generateOtp.bind(otpController));

/**
 * @swagger
 * /api/otp/verify:
 *   post:
 *     summary: Verify OTP code
 *     tags: [OTP Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VerifyOtpResponse'
 *       400:
 *         description: Bad request - validation error or invalid OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VerifyOtpResponse'
 *       500:
 *         description: Internal server error
 */
router.post('/verify', otpController.verifyOtp.bind(otpController));

/**
 * @swagger
 * /api/otp/complete-registration:
 *   post:
 *     summary: Complete user registration after OTP verification
 *     tags: [OTP Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompleteRegistrationRequest'
 *     responses:
 *       200:
 *         description: Registration completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                 message:
 *                   type: string
 *                   example: "Registration completed successfully"
 *       400:
 *         description: Bad request - validation error or registration failed
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/complete-registration', otpController.completeRegistration.bind(otpController));

/**
 * @swagger
 * /api/otp/health:
 *   get:
 *     summary: Health check for OTP service
 *     tags: [OTP Authentication]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "OTP service is healthy"
 *                 timestamp:
 *                   type: string
 *                   example: "2025-08-26T06:15:00.000Z"
 */
router.get('/health', otpController.healthCheck.bind(otpController));

export default router;