import { Router } from 'express';
import duprController from '../controllers/duprController';
import { duprApiLimiter } from '../middleware/rateLimiter';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

// Apply authentication to all DUPR routes
router.use(requireAuth);

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
 * /api/dupr/upload-match:
 *   post:
 *     tags:
 *       - DUPR Match Upload
 *     summary: Upload Match Result to DUPR
 *     description: Upload a completed match result to DUPR system for rating calculation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DuprMatchUploadRequest'
 *           examples:
 *             singlesMatch:
 *               summary: Singles match upload
 *               value:
 *                 tournament_id: "tournament-123"
 *                 event_name: "Summer Tournament 2024"
 *                 event_date: "2024-08-15"
 *                 location: "Local Recreation Center"
 *                 match_type: "singles"
 *                 team1_player1_dupr_id: "player-456"
 *                 team1_player1_name: "John Smith"
 *                 team2_player1_dupr_id: "player-789"
 *                 team2_player1_name: "Jane Doe"
 *                 team1_score: 11
 *                 team2_score: 8
 *                 completed_at: "2024-08-15T14:30:00Z"
 *             doublesMatch:
 *               summary: Doubles match upload
 *               value:
 *                 tournament_id: "tournament-123"
 *                 event_name: "Summer Tournament 2024"
 *                 event_date: "2024-08-15"
 *                 location: "Local Recreation Center"
 *                 match_type: "doubles"
 *                 team1_player1_dupr_id: "player-456"
 *                 team1_player1_name: "John Smith"
 *                 team1_player2_dupr_id: "player-111"
 *                 team1_player2_name: "Bob Johnson"
 *                 team2_player1_dupr_id: "player-789"
 *                 team2_player1_name: "Jane Doe"
 *                 team2_player2_dupr_id: "player-222"
 *                 team2_player2_name: "Alice Brown"
 *                 team1_score: 11
 *                 team2_score: 9
 *                 completed_at: "2024-08-15T15:45:00Z"
 *                 court_number: 3
 *     responses:
 *       200:
 *         description: Match uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DuprMatchUploadResponse'
 *             examples:
 *               success:
 *                 summary: Match upload successful
 *                 value:
 *                   success: true
 *                   data:
 *                     dupr_match_id: "dupr-match-789"
 *                     tournament_id: "tournament-123"
 *                     status: "processed"
 *                     uploaded_at: "2024-08-15T16:00:00Z"
 *                   message: "Match uploaded successfully to DUPR"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/upload-match', duprController.uploadMatch);

/**
 * @swagger
 * /api/dupr/upload-matches:
 *   post:
 *     tags:
 *       - DUPR Match Upload
 *     summary: Upload Multiple Match Results to DUPR
 *     description: Upload multiple completed match results to DUPR system in batch
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               matches:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/DuprMatchUploadRequest'
 *             required: [matches]
 *     responses:
 *       200:
 *         description: Matches upload completed
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
 *                         successful:
 *                           type: number
 *                         failed:
 *                           type: number
 *                         results:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/DuprMatchUploadResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/upload-matches', duprController.uploadMatches);

/**
 * @swagger
 * /api/dupr/update-match/{matchId}:
 *   put:
 *     tags:
 *       - DUPR Match Management
 *     summary: Update Match Result in DUPR
 *     description: Update an existing match result in DUPR system
 *     parameters:
 *       - name: matchId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: DUPR Match ID to update
 *         example: "123456"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DuprMatchUploadRequest'
 *     responses:
 *       200:
 *         description: Match updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DuprMatchUploadResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/update-match/:matchId', duprController.updateMatch);

/**
 * @swagger
 * /api/dupr/delete-match:
 *   delete:
 *     tags:
 *       - DUPR Match Management
 *     summary: Delete Match from DUPR
 *     description: Delete a match result from DUPR system
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               matchCode:
 *                 type: string
 *                 description: DUPR match code to delete
 *                 example: "ABC123"
 *               identifier:
 *                 type: string
 *                 description: Unique identifier of the match
 *                 example: "match-123-1234567890"
 *             required:
 *               - matchCode
 *               - identifier
 *     responses:
 *       200:
 *         description: Match deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DuprMatchUploadResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/delete-match', duprController.deleteMatch);

/**
 * @swagger
 * /api/dupr/match/{matchId}:
 *   get:
 *     tags:
 *       - DUPR Match Management
 *     summary: Get Match Information
 *     description: Retrieve detailed information about a specific match from DUPR
 *     parameters:
 *       - name: matchId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: DUPR Match ID to retrieve
 *         example: "123456"
 *     responses:
 *       200:
 *         description: Match information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       description: Match details from DUPR
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/match/:matchId', duprController.getMatchInfo);

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

/**
 * @swagger
 * /api/dupr/create-event:
 *   post:
 *     tags:
 *       - DUPR Event Management
 *     summary: Create Event in DUPR
 *     description: Create a new event in DUPR system (tournament or league)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data, date, metadata, text]
 *             properties:
 *               data:
 *                 type: object
 *                 required: [name, address, registrationUrl, minRating, maxRating, minAge, maxAge]
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Summer Pickleball Tournament 2024"
 *                   address:
 *                     type: string
 *                     example: "Newport Beach, CA"
 *                   registrationUrl:
 *                     type: string
 *                     example: "https://example.com/register"
 *                   minRating:
 *                     type: number
 *                     example: 2.0
 *                   maxRating:
 *                     type: number
 *                     example: 5.0
 *                   minAge:
 *                     type: number
 *                     example: 18
 *                   maxAge:
 *                     type: number
 *                     example: 65
 *               date:
 *                 type: object
 *                 required: [startTime, endTime]
 *                 properties:
 *                   startTime:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-08-15T09:00:00Z"
 *                   endTime:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-08-15T17:00:00Z"
 *               metadata:
 *                 type: object
 *                 required: [metadata]
 *                 properties:
 *                   metadata:
 *                     type: object
 *                     additionalProperties:
 *                       type: string
 *                     example: { "organizerId": "123", "type": "tournament" }
 *               text:
 *                 type: object
 *                 required: [text]
 *                 properties:
 *                   text:
 *                     type: object
 *                     additionalProperties:
 *                       type: string
 *                     example: { "description": "Annual summer tournament" }
 *     responses:
 *       200:
 *         description: Event created successfully
 *       400:
 *         description: Bad request - validation failed
 *       500:
 *         description: Internal server error
 */
router.post('/create-event', duprController.createEvent);

/**
 * @swagger
 * /api/dupr/update-event/{eventId}:
 *   put:
 *     tags:
 *       - DUPR Event Management
 *     summary: Update Event in DUPR
 *     description: Update an existing event in DUPR system
 *     parameters:
 *       - name: eventId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: DUPR Event ID to update
 *         example: "event-123"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data, date, metadata, text]
 *             properties:
 *               data:
 *                 type: object
 *               date:
 *                 type: object
 *               metadata:
 *                 type: object
 *               text:
 *                 type: object
 *     responses:
 *       200:
 *         description: Event updated successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.put('/update-event/:eventId', duprController.updateEvent);

/**
 * @swagger
 * /api/dupr/delete-event/{eventId}:
 *   delete:
 *     tags:
 *       - DUPR Event Management
 *     summary: Delete Event from DUPR
 *     description: Delete an event from DUPR system
 *     parameters:
 *       - name: eventId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: DUPR Event ID to delete
 *         example: "event-123"
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Event not found
 *       500:
 *         description: Internal server error
 */
router.delete('/delete-event/:eventId', duprController.deleteEvent);

/**
 * @swagger
 * /api/dupr/get-event/{eventId}:
 *   get:
 *     tags:
 *       - DUPR Event Management
 *     summary: Get Event Information
 *     description: Retrieve detailed information about a specific event from DUPR
 *     parameters:
 *       - name: eventId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: DUPR Event ID to retrieve
 *         example: "event-123"
 *     responses:
 *       200:
 *         description: Event information retrieved successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Event not found
 *       500:
 *         description: Internal server error
 */
router.get('/get-event/:eventId', duprController.getEvent);

/**
 * @swagger
 * /api/dupr/batch-update-players:
 *   post:
 *     tags:
 *       - DUPR Batch Operations
 *     summary: Batch Update Players DUPR Data
 *     description: Update DUPR data for multiple players in batches. Can update all players with DUPR IDs or filter by specific league. Admin access required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: league_id
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional league ID to filter players. If provided, only updates players registered in that league.
 *         example: "league-123"
 *     responses:
 *       200:
 *         description: Batch update completed successfully
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
 *                         success:
 *                           type: boolean
 *                           description: Overall operation success
 *                         message:
 *                           type: string
 *                           description: Summary of the batch operation
 *                         processed:
 *                           type: number
 *                           description: Total number of players processed
 *                         updated:
 *                           type: number
 *                           description: Number of players successfully updated
 *                         errors:
 *                           type: number
 *                           description: Number of players that failed to update
 *                         results:
 *                           type: array
 *                           description: Detailed results for each player
 *                           items:
 *                             type: object
 *                             properties:
 *                               userId:
 *                                 type: string
 *                                 description: User ID processed
 *                               duprId:
 *                                 type: string
 *                                 description: DUPR ID of the player
 *                               success:
 *                                 type: boolean
 *                                 description: Whether this player was updated successfully
 *                               error:
 *                                 type: string
 *                                 description: Error message if update failed
 *             examples:
 *               allPlayersSuccess:
 *                 summary: Successful batch update for all players
 *                 value:
 *                   success: true
 *                   data:
 *                     success: true
 *                     message: "Batch DUPR update completed: 25 updated, 0 errors out of 25 players processed"
 *                     processed: 25
 *                     updated: 25
 *                     errors: 0
 *                     results:
 *                       - userId: "user-123"
 *                         duprId: "4581541063"
 *                         success: true
 *                       - userId: "user-456"
 *                         duprId: "9876543210"
 *                         success: true
 *                   message: "Batch DUPR update completed: 25 updated, 0 errors out of 25 players processed"
 *               leaguePlayersWithErrors:
 *                 summary: League-specific update with some errors
 *                 value:
 *                   success: true
 *                   data:
 *                     success: true
 *                     message: "Batch DUPR update completed: 8 updated, 2 errors out of 10 users processed in league league-123"
 *                     processed: 10
 *                     updated: 8
 *                     errors: 2
 *                     results:
 *                       - userId: "user-123"
 *                         duprId: "4581541063"
 *                         success: true
 *                       - userId: "user-456"
 *                         duprId: "invalid-id"
 *                         success: false
 *                         error: "Player not found in DUPR database"
 *                   message: "Batch DUPR update completed: 8 updated, 2 errors out of 10 users processed in league league-123"
 *       400:
 *         description: Bad request - invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidLeagueId:
 *                 summary: Invalid league ID
 *                 value:
 *                   success: false
 *                   error: "Invalid league ID"
 *                   message: "The specified league ID does not exist"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Forbidden - admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notAdmin:
 *                 summary: Admin access required
 *                 value:
 *                   success: false
 *                   error: "Forbidden"
 *                   message: "Admin access required"
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/batch-update-players', requireAdmin, duprController.batchUpdatePlayersDuprData);

export default router;