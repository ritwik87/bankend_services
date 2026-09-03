import express from 'express';
import { leagueTeamController } from '../controllers/leagueTeamController';
import { requireAuth } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Every league team route requires an authenticated user.
router.use(requireAuth);

/**
 * Resolving a teammate can create a user account, so it is rate limited more tightly than the
 * read-only routes. A captain filling a team of 5 makes at most 4 calls.
 */
const resolvePlayerLimiter = createRateLimiter(15 * 60 * 1000, 30);

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
