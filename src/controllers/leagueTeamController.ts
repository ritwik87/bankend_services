import { Response } from 'express';
import Joi from 'joi';
import { AuthenticatedRequest } from '../middleware/auth';
import { leagueTeamService } from '../services/leagueTeam.service';
import { userService } from '../services/user.service';
import { supabase } from '../utils/supabase';
import logger from '../utils/logger';

const resolvePlayerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10}$/)
    .required(),
  duprId: Joi.string().trim().max(50).optional().allow(''),
});

const lookupPlayerSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10}$/)
    .required(),
});

const validateTeamSchema = Joi.object({
  memberIds: Joi.array().items(Joi.string().uuid()).min(1).max(20).required(),
});

const registerTeamSchema = Joi.object({
  teamName: Joi.string().trim().min(1).max(100).required(),
  memberIds: Joi.array().items(Joi.string().uuid()).min(1).max(20).required(),
});

const replaceMemberSchema = Joi.object({
  teamId: Joi.string().uuid().required(),
  outgoingPlayerId: Joi.string().uuid().required(),
  incomingPlayerId: Joi.string().uuid().required(),
});

/**
 * Confirm the caller may administer this league's teams: an admin, the league's organizer, or
 * (when a teamId is given) that team's captain.
 *
 * Module-level rather than a class method on purpose — handlers are passed to Express unbound
 * (`router.post(..., leagueTeamController.withdrawTeam)`), so `this` is undefined at call time.
 */
async function assertLeagueAccess(
  req: AuthenticatedRequest,
  leagueId: string,
  teamId?: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const userId = req.user?.id;
  const role = req.user?.role;

  if (!userId) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  if (role === 'admin') return { ok: true };

  const { data: league } = await supabase
    .from('leagues')
    .select('organizer_id')
    .eq('id', leagueId)
    .single();

  if (league?.organizer_id === userId) return { ok: true };

  if (teamId) {
    const { data: team } = await supabase
      .from('league_teams')
      .select('captain_id')
      .eq('id', teamId)
      .single();
    if (team?.captain_id === userId) return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    error: 'You do not have permission to manage this league',
  };
}

export class LeagueTeamController {
  /**
   * GET /api/leagues/:leagueId/team-name-available?name=...
   * Live check as the captain types. The partial unique index is the real backstop.
   */
  async checkTeamName(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { leagueId } = req.params;
      const name = String(req.query.name || '');

      const result = await leagueTeamService.checkTeamNameAvailable(
        leagueId,
        name
      );

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      logger.error('checkTeamName failed:', error);
      res
        .status(500)
        .json({ success: false, error: 'Could not check the team name' });
    }
  }

  /**
   * POST /api/leagues/:leagueId/resolve-player
   *
   * Find-or-create a teammate from a name and mobile number — no OTP.
   *
   * Wraps the existing userService.bulkRegisterUser rather than reimplementing user creation.
   * That method is also reachable via POST /api/user/bulk-register, but that route is
   * requireAdmin and a captain is a player, so this narrower entry point exists instead.
   *
   * Scoped deliberately: team-mode leagues only, registration still open. This lets a
   * non-admin cause account creation, so it must not be usable as a general signup hole.
   */
  async resolvePlayer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { leagueId } = req.params;
      const { error: validationError, value } = resolvePlayerSchema.validate(
        req.body
      );

      if (validationError) {
        res.status(400).json({
          success: false,
          error: validationError.details[0].message,
        });
        return;
      }

      const config = await leagueTeamService.getTeamLeagueConfig(leagueId);
      if (!config.ok || !config.league) {
        res.status(400).json({ success: false, error: config.reason });
        return;
      }

      const deadline = config.league.registration_deadline;
      if (deadline && new Date(deadline) < new Date(new Date().toDateString())) {
        res
          .status(400)
          .json({ success: false, error: 'Registration has closed for this league' });
        return;
      }

      const { name, phone, duprId } = value;

      const result = await userService.bulkRegisterUser({
        phone,
        userData: {
          name,
          // Same synthesis the admin bulk upload dialog uses.
          email: `${phone}@gmail.com`,
          role: 'player',
          ...(duprId ? { duprId } : {}),
        },
      });

      if (!result.success || !result.user) {
        res.status(400).json({
          success: false,
          error: result.error || result.message || 'Could not add this player',
        });
        return;
      }

      res.status(200).json({
        success: true,
        player: {
          id: result.user.id,
          name: result.user.name,
          phone: result.user.phone,
        },
        isExisting: !!result.isExisting,
      });
    } catch (error) {
      logger.error('resolvePlayer failed:', error);
      res
        .status(500)
        .json({ success: false, error: 'Could not add this player' });
    }
  }

  /**
   * POST /api/leagues/:leagueId/lookup-player
   *
   * Find a player by mobile number without creating anything, so the dialog can show their real
   * name before the captain commits. Only if nothing is found does the captain supply a name,
   * which then goes to resolve-player.
   */
  async lookupPlayer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { leagueId } = req.params;
      const { error: validationError, value } = lookupPlayerSchema.validate(
        req.body
      );

      if (validationError) {
        res.status(400).json({
          success: false,
          error: validationError.details[0].message,
        });
        return;
      }

      const config = await leagueTeamService.getTeamLeagueConfig(leagueId);
      if (!config.ok) {
        res.status(400).json({ success: false, error: config.reason });
        return;
      }

      const result = await leagueTeamService.lookupPlayerByPhone(value.phone);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      logger.error('lookupPlayer failed:', error);
      res
        .status(500)
        .json({ success: false, error: 'Could not look up this number' });
    }
  }

  /**
   * POST /api/leagues/:leagueId/validate-team
   * Preview of the eligibility result, so the form can show the running average and block
   * submission before the captain reaches payment.
   */
  async validateTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { leagueId } = req.params;
      const { error: validationError, value } = validateTeamSchema.validate(
        req.body
      );

      if (validationError) {
        res.status(400).json({
          success: false,
          error: validationError.details[0].message,
        });
        return;
      }

      const result = await leagueTeamService.validateLeagueTeamEligibility(
        leagueId,
        value.memberIds
      );

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      logger.error('validateTeam failed:', error);
      res
        .status(500)
        .json({ success: false, error: 'Could not validate the team' });
    }
  }

  /**
   * POST /api/leagues/:leagueId/team-registration
   *
   * The free path (no entry fee). Paid registrations are created by the Razorpay webhook
   * instead — see payment.service.createRegistrationRecord.
   */
  async registerFreeTeam(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { leagueId } = req.params;
      const captainId = req.user?.id;

      if (!captainId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { error: validationError, value } = registerTeamSchema.validate(
        req.body
      );

      if (validationError) {
        res.status(400).json({
          success: false,
          error: validationError.details[0].message,
        });
        return;
      }

      const { teamName, memberIds } = value;

      // The caller must be registering their own team.
      if (!memberIds.includes(captainId)) {
        res.status(403).json({
          success: false,
          error: 'You must be part of the team you are registering',
        });
        return;
      }

      // This endpoint is for free leagues only. A paid league must go through Razorpay so the
      // webhook creates the registration — otherwise a team could register without paying.
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('registration_fee')
        .eq('id', leagueId)
        .single();

      if (leagueError || !league) {
        res.status(404).json({ success: false, error: 'League not found' });
        return;
      }

      if (Number(league.registration_fee || 0) > 0) {
        res.status(400).json({
          success: false,
          error: 'This league has an entry fee — please register through payment',
        });
        return;
      }

      const eligibility = await leagueTeamService.validateLeagueTeamEligibility(
        leagueId,
        memberIds
      );

      if (!eligibility.ok) {
        res.status(400).json({ success: false, error: eligibility.reason });
        return;
      }

      const nameCheck = await leagueTeamService.checkTeamNameAvailable(
        leagueId,
        teamName
      );

      if (!nameCheck.available) {
        res.status(400).json({ success: false, error: nameCheck.reason });
        return;
      }

      const created = await leagueTeamService.createLeagueTeamRegistration({
        leagueId,
        teamName,
        memberIds,
        captainId,
        categoryId: eligibility.categoryId,
        paymentId: null,
        avgDupr: eligibility.avgDupr,
        status: 'confirmed',
      });

      if (!created.success) {
        res.status(400).json({ success: false, error: created.error });
        return;
      }

      res.status(201).json({
        success: true,
        teamId: created.teamId,
        registrationId: created.captainRegistrationId,
        avgDupr: eligibility.avgDupr,
      });
    } catch (error) {
      logger.error('registerFreeTeam failed:', error);
      res
        .status(500)
        .json({ success: false, error: 'Could not register the team' });
    }
  }

  /**
   * POST /api/leagues/:leagueId/replace-member
   * Organizer, admin, or the team's own captain may swap a player.
   */
  async replaceMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { leagueId } = req.params;
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { error: validationError, value } = replaceMemberSchema.validate(
        req.body
      );

      if (validationError) {
        res.status(400).json({
          success: false,
          error: validationError.details[0].message,
        });
        return;
      }

      const { teamId, outgoingPlayerId, incomingPlayerId } = value;

      const { data: team, error: teamError } = await supabase
        .from('league_teams')
        .select('id, league_id, captain_id, leagues:league_id (organizer_id)')
        .eq('id', teamId)
        .eq('league_id', leagueId)
        .single();

      if (teamError || !team) {
        res.status(404).json({ success: false, error: 'Team not found' });
        return;
      }

      const organizerId = (team as any).leagues?.organizer_id;
      const permitted =
        role === 'admin' ||
        team.captain_id === userId ||
        (role === 'organizer' && organizerId === userId);

      if (!permitted) {
        res.status(403).json({
          success: false,
          error: 'You do not have permission to change this team',
        });
        return;
      }

      const result = await leagueTeamService.replaceTeamMember({
        teamId,
        outgoingPlayerId,
        incomingPlayerId,
      });

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.status(200).json({ success: true, avgDupr: result.avgDupr });
    } catch (error) {
      logger.error('replaceMember failed:', error);
      res
        .status(500)
        .json({ success: false, error: 'Could not replace the player' });
    }
  }


  /** POST /api/leagues/:leagueId/teams/:teamId/withdraw */
  async withdrawTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { leagueId, teamId } = req.params;

      const access = await assertLeagueAccess(req, leagueId, teamId);
      if (!access.ok) {
        res
          .status(access.status || 403)
          .json({ success: false, error: access.error });
        return;
      }

      const result = await leagueTeamService.withdrawTeam(teamId);
      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('withdrawTeam failed:', error);
      res
        .status(500)
        .json({ success: false, error: 'Could not withdraw the team' });
    }
  }

  /** POST /api/leagues/:leagueId/teams/:teamId/sync-captain */
  async syncCaptain(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { leagueId, teamId } = req.params;
      const { captainId } = req.body || {};

      if (!captainId || typeof captainId !== 'string') {
        res.status(400).json({ success: false, error: 'captainId is required' });
        return;
      }

      const access = await assertLeagueAccess(req, leagueId, teamId);
      if (!access.ok) {
        res
          .status(access.status || 403)
          .json({ success: false, error: access.error });
        return;
      }

      const result = await leagueTeamService.syncCaptainFlag(teamId, captainId);
      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('syncCaptain failed:', error);
      res
        .status(500)
        .json({ success: false, error: 'Could not update the captain' });
    }
  }

  /** GET /api/leagues/:leagueId/missing-team-registrations */
  async missingTeamRegistrations(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { leagueId } = req.params;

      const access = await assertLeagueAccess(req, leagueId);
      if (!access.ok) {
        res
          .status(access.status || 403)
          .json({ success: false, error: access.error });
        return;
      }

      const result = await leagueTeamService.findMissingTeamRegistrations(
        leagueId
      );
      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error('missingTeamRegistrations failed:', error);
      res
        .status(500)
        .json({ success: false, error: 'Could not load pending team orders' });
    }
  }

  /** POST /api/leagues/:leagueId/retry-team-registration */
  async retryTeamRegistration(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { leagueId } = req.params;
      const { orderId } = req.body || {};

      if (!orderId || typeof orderId !== 'string') {
        res.status(400).json({ success: false, error: 'orderId is required' });
        return;
      }

      const access = await assertLeagueAccess(req, leagueId);
      if (!access.ok) {
        res
          .status(access.status || 403)
          .json({ success: false, error: access.error });
        return;
      }

      const result = await leagueTeamService.retryTeamRegistration(orderId);
      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.status(201).json({ success: true, teamId: result.teamId });
    } catch (error) {
      logger.error('retryTeamRegistration failed:', error);
      res
        .status(500)
        .json({ success: false, error: 'Could not retry the registration' });
    }
  }
}

export const leagueTeamController = new LeagueTeamController();
