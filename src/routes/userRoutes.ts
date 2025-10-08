import express from 'express';
import { userController } from '../controllers/userController';
import { duprApiLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all user routes
router.use(requireAuth);

// Apply rate limiting to all user routes
router.use(duprApiLimiter);

/**
 * @swagger
 * /api/user/health:
 *   get:
 *     summary: Health check for user service
 *     tags: [User]
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
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 */
router.get('/health', userController.healthCheck);

/**
 * @swagger
 * /api/user/validate-email:
 *   get:
 *     summary: Validate if email is available
 *     tags: [User]
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: Email to validate
 *       - in: query
 *         name: excludeUserId
 *         schema:
 *           type: string
 *         description: User ID to exclude from validation (for current user updates)
 *     responses:
 *       200:
 *         description: Email validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 available:
 *                   type: boolean
 *                 error:
 *                   type: string
 *       400:
 *         description: Validation error
 */
router.get('/validate-email', userController.validateEmailAvailability);

/**
 * @swagger
 * /api/user/update-email:
 *   post:
 *     summary: Update user email address
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - newEmail
 *               - currentEmail
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user to update
 *               newEmail:
 *                 type: string
 *                 format: email
 *                 description: New email address
 *               currentEmail:
 *                 type: string
 *                 format: email
 *                 description: Current email address
 *     responses:
 *       200:
 *         description: Email updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Update failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.post('/update-email', userController.updateEmail);

export default router;