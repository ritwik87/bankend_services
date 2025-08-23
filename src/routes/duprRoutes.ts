import { Router } from 'express';
import duprController from '../controllers/duprController';
import { duprApiLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiting to all DUPR routes
router.use(duprApiLimiter);

/**
 * @swagger
 * /api/dupr/validate:
 *   post:
 *     tags:
 *       - DUPR Validation
 *     summary: Validate DUPR Player ID
 *     description: Validate a DUPR player ID with optional email/phone verification against the official DUPR database
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DuprValidationRequest'
 *           examples:
 *             basic:
 *               summary: Basic validation
 *               value:
 *                 duprId: "player-123"
 *             withEmail:
 *               summary: Validation with email verification
 *               value:
 *                 duprId: "player-123"
 *                 email: "player@example.com"
 *             withPhone:
 *               summary: Validation with phone verification
 *               value:
 *                 duprId: "player-123"
 *                 phone: "+1-555-0123"
 *             complete:
 *               summary: Complete validation
 *               value:
 *                 duprId: "player-123"
 *                 email: "player@example.com"
 *                 phone: "+1-555-0123"
 *     responses:
 *       200:
 *         description: Validation successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DuprValidationResponse'
 *             examples:
 *               validPlayer:
 *                 summary: Valid player found
 *                 value:
 *                   success: true
 *                   data:
 *                     isValid: true
 *                     player:
 *                       id: "player-123"
 *                       firstName: "John"
 *                       lastName: "Doe"
 *                       email: "john.doe@example.com"
 *                       duprId: "player-123"
 *                       singlesRating: 4.250
 *                       doublesRating: 4.150
 *                       reliability: 85
 *                       isActive: true
 *                       createdAt: "2023-01-15T10:30:00Z"
 *                       updatedAt: "2024-01-20T14:22:00Z"
 *                   message: "Player validated successfully"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/validate', duprController.validatePlayer);

/**
 * @swagger
 * /api/dupr/rating/{duprId}:
 *   get:
 *     tags:
 *       - DUPR Ratings
 *     summary: Get DUPR Rating
 *     description: Retrieve current DUPR singles and doubles ratings for a specific player
 *     parameters:
 *       - $ref: '#/components/parameters/DuprId'
 *     responses:
 *       200:
 *         description: Rating retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DuprRatingResponse'
 *             examples:
 *               playerRating:
 *                 summary: Player rating found
 *                 value:
 *                   success: true
 *                   data:
 *                     duprId: "player-123"
 *                     singlesRating: 4.250
 *                     doublesRating: 4.150
 *                     reliability: 85
 *                     lastUpdated: "2024-01-20T14:22:00Z"
 *                   message: "Player rating retrieved successfully"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/rating/:duprId', duprController.getPlayerRating);

/**
 * @swagger
 * /api/dupr/lookup:
 *   get:
 *     tags:
 *       - DUPR Lookup
 *     summary: Get DUPR ID by Email
 *     description: Find a player's DUPR ID using their email address
 *     parameters:
 *       - name: email
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: Email address to look up
 *         example: "player@example.com"
 *     responses:
 *       200:
 *         description: DUPR ID found successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         email:
 *                           type: string
 *                           format: email
 *                           description: Email address that was searched
 *                         duprId:
 *                           type: string
 *                           description: Found DUPR ID
 *                       required: [email, duprId]
 *             examples:
 *               found:
 *                 summary: DUPR ID found
 *                 value:
 *                   success: true
 *                   data:
 *                     email: "player@example.com"
 *                     duprId: "4581541063"
 *                   message: "DUPR ID found for email"
 *       400:
 *         description: Bad request - invalid or missing email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingEmail:
 *                 summary: Missing email parameter
 *                 value:
 *                   success: false
 *                   error: "Email parameter is required"
 *                   message: "Please provide a valid email address"
 *               invalidEmail:
 *                 summary: Invalid email format
 *                 value:
 *                   success: false
 *                   error: "Invalid email format"
 *                   message: "Please provide a valid email address"
 *       404:
 *         description: DUPR ID not found for email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notFound:
 *                 summary: DUPR ID not found
 *                 value:
 *                   success: false
 *                   error: "DUPR ID not found"
 *                   message: "No DUPR ID found for the provided email address"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/lookup', duprController.getDuprIdByEmail);

/**
 * @swagger
 * /api/dupr/search:
 *   get:
 *     tags:
 *       - DUPR Search
 *     summary: Search DUPR Players
 *     description: Search for players in the DUPR database by name, email, or other criteria
 *     parameters:
 *       - $ref: '#/components/parameters/SearchQuery'
 *     responses:
 *       200:
 *         description: Search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DuprPlayer'
 *             examples:
 *               searchResults:
 *                 summary: Players found
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: "player-123"
 *                       firstName: "John"
 *                       lastName: "Doe"
 *                       duprId: "player-123"
 *                       singlesRating: 4.250
 *                       doublesRating: 4.150
 *                       isActive: true
 *                       createdAt: "2023-01-15T10:30:00Z"
 *                       updatedAt: "2024-01-20T14:22:00Z"
 *                   message: "Found 1 players"
 *               noResults:
 *                 summary: No players found
 *                 value:
 *                   success: true
 *                   data: []
 *                   message: "Found 0 players"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/search', duprController.searchPlayers);

/**
 * @swagger
 * /api/dupr/health:
 *   get:
 *     tags:
 *       - Health Check
 *     summary: Service Health Check
 *     description: Check if the DUPR service is healthy and operational
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/HealthCheckResponse'
 *             examples:
 *               healthy:
 *                 summary: Service is healthy
 *                 value:
 *                   success: true
 *                   data:
 *                     status: "healthy"
 *                     timestamp: "2024-01-20T14:22:00Z"
 *                   message: "DUPR service is healthy"
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               unhealthy:
 *                 summary: Service is unhealthy
 *                 value:
 *                   success: false
 *                   error: "Service unhealthy"
 *                   message: "DUPR service health check failed"
 */
router.get('/health', duprController.healthCheck);

export default router;