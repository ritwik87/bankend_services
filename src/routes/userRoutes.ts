import express from 'express';
import { userController } from '../controllers/userController';
import { duprApiLimiter } from '../middleware/rateLimiter';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all user routes
router.use(requireAuth);

// Apply rate limiting to all user routes
// router.use(duprApiLimiter);

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

/**
 * @swagger
 * /api/user/deactivate:
 *   post:
 *     summary: Deactivate user by changing role to guest (admin only)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user to deactivate
 *     responses:
 *       200:
 *         description: User deactivated successfully
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
 *         description: Deactivation failed
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/deactivate', requireAdmin, userController.deactivateUser);

/**
 * @swagger
 * /api/user/delete:
 *   post:
 *     summary: Permanently delete user (admin only, cascades to all tables)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user to delete permanently
 *     responses:
 *       200:
 *         description: User deleted successfully
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
 *         description: Deletion failed
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/delete', requireAdmin, userController.deleteUser);

/**
 * @swagger
 * /api/user/update:
 *   post:
 *     summary: Update user profile (admin only)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - userData
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user to update
 *               userData:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *                   phone:
 *                     type: string
 *                   age:
 *                     type: number
 *                   date_of_birth:
 *                     type: string
 *                     format: date
 *                   dupr_id:
 *                     type: string
 *                   role:
 *                     type: string
 *                     enum: [player, organizer, admin, umpire, guest]
 *     responses:
 *       200:
 *         description: User updated successfully
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
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/update', requireAdmin, userController.updateUser);

/**
 * @swagger
 * /api/user/admin-register:
 *   post:
 *     summary: Admin register user without OTP (admin only)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - userData
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Phone number in E.164 format
 *                 example: "+919876543210"
 *                 pattern: "^\\+[1-9]\\d{1,3}[0-9]{6,14}$"
 *               userData:
 *                 type: object
 *                 required:
 *                   - name
 *                   - email
 *                   - role
 *                 properties:
 *                   name:
 *                     type: string
 *                     minLength: 2
 *                     example: "John Doe"
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: "john@example.com"
 *                   role:
 *                     type: string
 *                     enum: [player, organizer, admin, umpire]
 *                     example: "player"
 *                   organizationName:
 *                     type: string
 *                     minLength: 2
 *                     example: "Sports Club"
 *                   organizationDescription:
 *                     type: string
 *                     minLength: 10
 *                     example: "Local sports organization"
 *                   experience:
 *                     type: string
 *                     minLength: 5
 *                     example: "5 years of tournament organization"
 *     responses:
 *       200:
 *         description: User created/updated successfully without OTP
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
 *                   example: "User created successfully"
 *       400:
 *         description: Bad request - validation error
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/admin-register', requireAdmin, userController.adminRegisterUser);

/**
 * @swagger
 * /api/user/bulk-register:
 *   post:
 *     summary: Bulk register multiple users (admin only)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - users
 *             properties:
 *               users:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - phone
 *                     - userData
 *                   properties:
 *                     phone:
 *                       type: string
 *                       description: Phone number in E.164 format
 *                       example: "+919876543210"
 *                       pattern: "^\\+[1-9]\\d{1,3}[0-9]{6,14}$"
 *                     userData:
 *                       type: object
 *                       required:
 *                         - name
 *                         - email
 *                         - role
 *                       properties:
 *                         name:
 *                           type: string
 *                           minLength: 2
 *                           example: "John Doe"
 *                         email:
 *                           type: string
 *                           format: email
 *                           example: "john@example.com"
 *                         role:
 *                           type: string
 *                           enum: [player, organizer, admin, umpire]
 *                           example: "player"
 *                         duprId:
 *                           type: string
 *                           minLength: 5
 *                           example: "ABC123"
 *                         organizationName:
 *                           type: string
 *                           minLength: 2
 *                           example: "Sports Club"
 *                         organizationDescription:
 *                           type: string
 *                           minLength: 10
 *                           example: "Local sports organization"
 *                         experience:
 *                           type: string
 *                           minLength: 5
 *                           example: "5 years of tournament organization"
 *     responses:
 *       200:
 *         description: Bulk registration completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       success:
 *                         type: boolean
 *                       user:
 *                         type: object
 *                       message:
 *                         type: string
 *                       error:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       name:
 *                         type: string
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     successful:
 *                       type: number
 *                     failed:
 *                       type: number
 *       400:
 *         description: Bad request - validation error
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/bulk-register', requireAdmin, userController.bulkRegisterUsers);

export default router;