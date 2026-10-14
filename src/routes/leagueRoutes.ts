import express from 'express';
import { leagueTeamController } from '../controllers/leagueTeamController';
import {
  requireAuth,
  requireAdminOrOrganizer,
  AuthenticatedRequest,
} from '../middleware/auth';
import { leaguePlayerCategoryService } from '../services/leaguePlayerCategory.service';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Every league team route requires an authenticated user.
router.use(requireAuth);

/**
 * Resolving a teammate can create a user account, so it is rate limited more tightly than the
 * read-only routes. A captain filling a team of 5 makes at most 4 calls.
 */
const resolvePlayerLimiter = createRateLimiter(15 * 60 * 1000, 30);

/**
 * POST /api/leagues/:leagueId/assign-my-category
 * Free individual registrations are created by the browser, which cannot write
 * league_player_categories (RLS) — so the player's own category is derived here.
 */
router.post(
  '/:leagueId/assign-my-category',
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const result = await leaguePlayerCategoryService.assignForPlayer(
      req.params.leagueId,
      userId
    );
    return res.json({ success: true, ...result });
  }
);

/**
 * POST /api/leagues/:leagueId/assign-category  { playerId }
 * Admin/organizer manual registrations bypass both the webhook and the player's own free flow,
 * so the manual registration dialog calls this to derive the registered player's category.
 */
router.post(
  '/:leagueId/assign-category',
  requireAdminOrOrganizer,
  async (req: AuthenticatedRequest, res) => {
    const playerId = req.body?.playerId;
    if (!playerId || typeof playerId !== 'string') {
      return res.status(400).json({ success: false, error: 'playerId is required' });
    }
    const result = await leaguePlayerCategoryService.assignForPlayer(
      req.params.leagueId,
      playerId
    );
    return res.json({ success: true, ...result });
  }
);

/** GET /api/leagues/:leagueId/team-name-available?name=... */
router.get(
  '/:leagueId/team-name-available',
  leagueTeamController.checkTeamName
);

/** POST /api/leagues/:leagueId/resolve-player — find-or-create a teammate by name + phone */
router.post(
  '/:leagueId/resolve-player',
  resolvePlayerLimiter,
  leagueTeamController.resolvePlayer
);

/** POST /api/leagues/:leagueId/lookup-player — find a player by phone, creating nothing */
router.post('/:leagueId/lookup-player', leagueTeamController.lookupPlayer);

/** POST /api/leagues/:leagueId/validate-team — eligibility preview for the form */
router.post('/:leagueId/validate-team', leagueTeamController.validateTeam);

/** POST /api/leagues/:leagueId/team-registration — free leagues only */
router.post(
  '/:leagueId/team-registration',
  leagueTeamController.registerFreeTeam
);

/** POST /api/leagues/:leagueId/replace-member */
router.post('/:leagueId/replace-member', leagueTeamController.replaceMember);

/** POST /api/leagues/:leagueId/teams/:teamId/withdraw — remove a team and its registrations */
router.post(
  '/:leagueId/teams/:teamId/withdraw',
  leagueTeamController.withdrawTeam
);

/**
 * POST /api/leagues/:leagueId/teams/:teamId/sync-captain
 * Keeps league_registrations.is_captain aligned with league_teams.captain_id after a reassignment.
 */
router.post(
  '/:leagueId/teams/:teamId/sync-captain',
  leagueTeamController.syncCaptain
);

/** GET /api/leagues/:leagueId/missing-team-registrations — teams that paid but never landed */
router.get(
  '/:leagueId/missing-team-registrations',
  leagueTeamController.missingTeamRegistrations
);

/** POST /api/leagues/:leagueId/retry-team-registration — re-run creation from stored context */
router.post(
  '/:leagueId/retry-team-registration',
  leagueTeamController.retryTeamRegistration
);

export default router;
