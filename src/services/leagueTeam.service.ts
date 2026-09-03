import logger from '../utils/logger';
import { supabase } from '../utils/supabase';
import duprPlayerService from './duprPlayer.service';
import { phoneOrCondition } from '../utils/helper';

/**
 * League team registration (Micro League).
 *
 * A captain registers a whole team in one transaction: one payment, one league_teams row,
 * N league_team_members rows, and N league_registrations rows sharing a payment_id.
 *
 * These functions run with the service-role key. That is deliberate: RLS restricts INSERT on
 * league_teams to organizers and admins ("League teams insert policy"), so a captain cannot
 * create their own team from the client. Every entry point here must therefore do its own
 * authorization — see the route handlers.
 */

export interface TeamMemberRating {
  playerId: string;
  name: string | null;
  duprId: string | null;
  rating: number | null;
  error?: string;
}

export interface TeamEligibilityResult {
  ok: boolean;
  avgDupr: number | null;
  cap: number | null;
  categoryId: string | null;
  perPlayer: TeamMemberRating[];
  reason?: string;
}

/** Round half-up to 2 decimals. The number shown to the captain is the number enforced. */
function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export class LeagueTeamService {
  /**
   * Live DUPR rating for one player.
   *
   * Always hits the DUPR API — never reads the cached profiles.dupr_player_data, because a
   * stale rating could let a team slip past the average cap.
   *
   * Returns `undefined` to mean "could not determine" (API failure), distinct from `null`
   * which means "player has no rating". Callers must fail closed on `undefined`.
   */
  private async fetchLiveRating(
    duprId: string
  ): Promise<{ rating: number | null; playerData: any } | undefined> {
    try {
      const result = await duprPlayerService.validatePlayer({ duprId });

      if (!result.isValid || !result.player) {
        // A definitive "not found" is not an outage — the player genuinely has no DUPR record.
        return { rating: null, playerData: null };
      }

      const player: any = result.player;
      const ratings = player.ratings || {};

      // Same COALESCE(doubles, singles) the database rules mandate for match_participants_view.
      // Ratings arrive as numbers or as strings like "NR" for unrated players.
      const doubles = Number(ratings.doubles);
      const singles = Number(ratings.singles);
      const rating = Number.isFinite(doubles)
        ? doubles
        : Number.isFinite(singles)
        ? singles
        : null;

      return { rating, playerData: player };
    } catch (error) {
      logger.error(`Live DUPR lookup failed for ${duprId}:`, error);
      return undefined;
    }
  }

  /**
   * Refresh a profile's cached DUPR data.
   *
   * Only ever called with a successful lookup. A failed or empty response must never overwrite
   * an existing value — profiles.dupr_player_data is read by tournament screens too, and
   * blanking it would degrade them for a player who never touched this league.
   */
  private async persistPlayerData(
    playerId: string,
    playerData: any
  ): Promise<void> {
    if (!playerData) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        dupr_player_data: playerData,
        dupr_validated: true,
        dupr_validated_at: new Date().toISOString(),
      })
      .eq('id', playerId);

    if (error) {
      // Non-fatal: the rating we already hold in memory is what gates the registration.
      logger.warn(`Could not cache DUPR data for player ${playerId}:`, error);
    }
  }

  /**
   * Load the team-mode configuration for a league, including its single category.
   */
  async getTeamLeagueConfig(leagueId: string): Promise<{
    ok: boolean;
    league?: any;
    categoryId?: string;
    reason?: string;
  }> {
    const { data: league, error } = await supabase
      .from('leagues')
      .select(
        'id, name, registration_mode, min_team_members, max_team_members, max_avg_team_dupr, registration_deadline, status'
      )
      .eq('id', leagueId)
      .single();

    if (error || !league) {
      logger.error(`League not found: ${leagueId}`, error);
      return { ok: false, reason: 'League not found' };
    }

    if (league.registration_mode !== 'team') {
      return { ok: false, reason: 'This league does not accept team registrations' };
    }

    // Team-mode leagues carry exactly one category. Every registration and match inherits it,
    // and league standings look up win_points by category_id — a NULL there scores every win
    // as zero, so this is enforced rather than assumed.
    const { data: categories, error: catError } = await supabase
      .from('league_category_settings')
      .select('category_id')
      .eq('league_id', leagueId);

    if (catError) {
      logger.error(`Failed to load categories for league ${leagueId}:`, catError);
      return { ok: false, reason: 'Could not load league category' };
    }

    if (!categories || categories.length !== 1) {
      return {
        ok: false,
        reason: `Team leagues must have exactly one category configured (found ${
          categories?.length ?? 0
        })`,
      };
    }

    return { ok: true, league, categoryId: categories[0].category_id };
  }

  /**
   * Check every rule that governs whether a set of players may register as a team.
   *
   * Called at two points: order creation (the authoritative gate, before money is taken) and
   * again in the webhook as a backstop. One implementation so the two can never disagree.
   */
  async validateLeagueTeamEligibility(
    leagueId: string,
    memberIds: string[]
  ): Promise<TeamEligibilityResult> {
    const empty: TeamEligibilityResult = {
      ok: false,
      avgDupr: null,
      cap: null,
      categoryId: null,
      perPlayer: [],
    };

    const config = await this.getTeamLeagueConfig(leagueId);
    if (!config.ok || !config.league) {
      return { ...empty, reason: config.reason };
    }

    const league = config.league;
    const cap =
      league.max_avg_team_dupr === null || league.max_avg_team_dupr === undefined
        ? null
        : Number(league.max_avg_team_dupr);

    // --- Team size -------------------------------------------------------------------
    const uniqueIds = [...new Set(memberIds)];
    if (uniqueIds.length !== memberIds.length) {
      return { ...empty, cap, reason: 'The same player is listed more than once' };
    }
    if (uniqueIds.length < league.min_team_members) {
      return {
        ...empty,
        cap,
        reason: `A team needs at least ${league.min_team_members} players`,
      };
    }
    if (uniqueIds.length > league.max_team_members) {
      return {
        ...empty,
        cap,
        reason: `A team can have at most ${league.max_team_members} players`,
      };
    }

    // --- Already registered ----------------------------------------------------------
    const { data: existing, error: existingError } = await supabase
      .from('league_registrations')
      .select('player_id, profiles:player_id (name)')
      .eq('league_id', leagueId)
      .in('player_id', uniqueIds);

    if (existingError) {
      logger.error('Failed to check existing registrations:', existingError);
      return { ...empty, cap, reason: 'Could not verify existing registrations' };
    }

    if (existing && existing.length > 0) {
      const names = existing
        .map((r: any) => r.profiles?.name || r.player_id)
        .join(', ');
      return {
        ...empty,
        cap,
        reason: `Already registered for this league: ${names}`,
      };
    }

    // --- Profiles --------------------------------------------------------------------
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, dupr_id')
      .in('id', uniqueIds);

    if (profileError || !profiles || profiles.length !== uniqueIds.length) {
      logger.error('Failed to load team member profiles:', profileError);
      return { ...empty, cap, reason: 'Could not load every team member' };
    }

    // --- Duplicate DUPR IDs ----------------------------------------------------------
    // A DUPR ID identifies one human. Two team members sharing one means the captain has
    // pasted the same id twice, which would otherwise average a single player's rating in
    // multiple times — a straightforward way to drag a team under the cap.
    // Checked regardless of whether a cap is configured, since it is a data-integrity problem
    // in its own right: the id also gets written back to each member's profile.
    const duprCounts = new Map<string, string[]>();
    for (const profile of profiles as any[]) {
      const id = (profile.dupr_id || '').trim().toUpperCase();
      if (!id) continue;
      if (!duprCounts.has(id)) duprCounts.set(id, []);
      duprCounts.get(id)!.push(profile.name || profile.id);
    }

    const sharedDupr = [...duprCounts.entries()].filter(
      ([, names]) => names.length > 1
    );

    if (sharedDupr.length > 0) {
      const [id, names] = sharedDupr[0];
      return {
        ...empty,
        cap,
        reason: `DUPR ID ${id} is used by more than one player (${names.join(
          ', '
        )}). Each team member needs their own DUPR ID.`,
      };
    }

    // No cap configured — size and duplicate rules still applied, ratings not required.
    if (cap === null) {
      return {
        ok: true,
        avgDupr: null,
        cap: null,
        categoryId: config.categoryId ?? null,
        perPlayer: profiles.map((p: any) => ({
          playerId: p.id,
          name: p.name,
          duprId: p.dupr_id,
          rating: null,
        })),
      };
    }

    // --- Live ratings ----------------------------------------------------------------
    const perPlayer: TeamMemberRating[] = [];
    let apiFailed = false;

    for (const profile of profiles as any[]) {
      if (!profile.dupr_id) {
        perPlayer.push({
          playerId: profile.id,
          name: profile.name,
          duprId: null,
          rating: null,
          error: 'No DUPR ID on file',
        });
        continue;
      }

      const lookup = await this.fetchLiveRating(profile.dupr_id);

      if (lookup === undefined) {
        apiFailed = true;
        perPlayer.push({
          playerId: profile.id,
          name: profile.name,
          duprId: profile.dupr_id,
          rating: null,
          error: 'Could not reach DUPR',
        });
        continue;
      }

      if (lookup.playerData) {
        await this.persistPlayerData(profile.id, lookup.playerData);
      }

      perPlayer.push({
        playerId: profile.id,
        name: profile.name,
        duprId: profile.dupr_id,
        rating: lookup.rating,
        ...(lookup.rating === null ? { error: 'No DUPR rating' } : {}),
      });
    }

    // Fail closed. Falling back to cached ratings here would defeat the cap, which is the
    // entire point of the rule.
    if (apiFailed) {
      return {
        ...empty,
        cap,
        perPlayer,
        reason: 'Could not verify DUPR ratings right now. Please try again.',
      };
    }

    // An unrated player blocks the team. Counting them as 0 — or excluding them from the
    // mean — would let a team average its way under the cap with a ringer.
    const unrated = perPlayer.filter((p) => p.rating === null);
    if (unrated.length > 0) {
      const names = unrated.map((p) => p.name || p.playerId).join(', ');
      return {
        ...empty,
        cap,
        perPlayer,
        reason: `Every player needs a DUPR rating to register. Missing: ${names}`,
      };
    }

    const sum = perPlayer.reduce((acc, p) => acc + (p.rating as number), 0);
    const avgDupr = roundTo2(sum / perPlayer.length);

    if (avgDupr > cap) {
      return {
        ok: false,
        avgDupr,
        cap,
        categoryId: config.categoryId ?? null,
        perPlayer,
        reason: `Team average DUPR is ${avgDupr.toFixed(
          2
        )}, which exceeds the limit of ${cap.toFixed(2)}`,
      };
    }

    return {
      ok: true,
      avgDupr,
      cap,
      categoryId: config.categoryId ?? null,
      perPlayer,
    };
  }

  /**
   * Look a player up by mobile number without creating anything.
   *
   * Mirrors how tournament partner selection works: the phone is the identifier, and an existing
   * player's own profile name is authoritative. Asking the captain to type a name for someone who
   * already has an account would silently discard what they typed, since the stored name wins.
   */
  async lookupPlayerByPhone(phone: string): Promise<{
    found: boolean;
    player?: {
      id: string;
      name: string;
      phone: string;
      duprId: string | null;
    };
  }> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, phone, dupr_id')
      .or(phoneOrCondition(phone))
      .limit(1);

    if (error) {
      logger.error('Player lookup failed:', error);
      return { found: false };
    }

    if (!data || data.length === 0) {
      return { found: false };
    }

    const profile = data[0] as any;
    return {
      found: true,
      player: {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        duprId: profile.dupr_id ?? null,
      },
    };
  }

  /**
   * Is this team name free within the league?
   *
   * Case-insensitive, and scoped to self-registered teams only — organizer and auction-created
   * teams are allowed to share names (the original unique constraint was dropped in
   * 20250906182122 for exactly that reason).
   */
  async checkTeamNameAvailable(
    leagueId: string,
    name: string,
    excludeTeamId?: string
  ): Promise<{ available: boolean; reason?: string }> {
    const trimmed = (name || '').trim();

    if (!trimmed) {
      return { available: false, reason: 'Team name is required' };
    }
    if (trimmed.length > 100) {
      return { available: false, reason: 'Team name is too long' };
    }

    let query = supabase
      .from('league_teams')
      .select('id, name')
      .eq('league_id', leagueId)
      .eq('is_self_registered', true)
      .ilike('name', trimmed);

    if (excludeTeamId) {
      query = query.neq('id', excludeTeamId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Team name availability check failed:', error);
      return { available: false, reason: 'Could not check the team name' };
    }

    if (data && data.length > 0) {
      return { available: false, reason: 'That team name is already taken' };
    }

    return { available: true };
  }

  /**
   * Create the team, its members, and one registration per member.
   *
   * Rolls the team row back if any dependent insert fails, so a failure never leaves an
   * orphan team occupying a slot or holding a name.
   */
  async createLeagueTeamRegistration(params: {
    leagueId: string;
    teamName: string;
    memberIds: string[];
    captainId: string;
    categoryId: string | null;
    paymentId?: string | null;
    avgDupr?: number | null;
    status?: 'confirmed' | 'pending';
  }): Promise<{
    success: boolean;
    teamId?: string;
    captainRegistrationId?: string;
    error?: string;
  }> {
    const {
      leagueId,
      teamName,
      memberIds,
      captainId,
      categoryId,
      paymentId = null,
      avgDupr = null,
      status = 'confirmed',
    } = params;

    if (!memberIds.includes(captainId)) {
      return { success: false, error: 'The captain must be part of the team' };
    }

    // 1. Team
    const { data: team, error: teamError } = await supabase
      .from('league_teams')
      .insert({
        league_id: leagueId,
        name: teamName.trim(),
        captain_id: captainId,
        owner_id: captainId,
        status: 'active',
        is_self_registered: true,
        avg_dupr_at_registration: avgDupr,
      })
      .select('id')
      .single();

    if (teamError || !team) {
      // 23505 = unique_violation, i.e. the partial index on (league_id, lower(name))
      if ((teamError as any)?.code === '23505') {
        return { success: false, error: 'That team name is already taken' };
      }
      logger.error('Failed to create league team:', teamError);
      return { success: false, error: 'Could not create the team' };
    }

    const teamId = team.id;

    const rollback = async (reason: string, err: unknown) => {
      logger.error(`${reason} — rolling back team ${teamId}:`, err);
      await supabase.from('league_registrations').delete().eq('team_id', teamId);
      await supabase.from('league_team_members').delete().eq('team_id', teamId);
      await supabase.from('league_teams').delete().eq('id', teamId);
    };

    // 2. Members
    const { error: memberError } = await supabase
      .from('league_team_members')
      .insert(
        memberIds.map((playerId) => ({
          team_id: teamId,
          player_id: playerId,
          role: playerId === captainId ? 'captain' : 'player',
          status: 'active',
        }))
      );

    if (memberError) {
      await rollback('Failed to add team members', memberError);
      return { success: false, error: 'Could not add the team members' };
    }

    // 3. Registrations — one per member, all sharing the payment
    const { data: registrations, error: regError } = await supabase
      .from('league_registrations')
      .insert(
        memberIds.map((playerId) => ({
          league_id: leagueId,
          player_id: playerId,
          team_id: teamId,
          is_captain: playerId === captainId,
          status,
          payment_status: paymentId ? 'paid' : 'pending',
          ...(paymentId ? { payment_id: paymentId } : {}),
          ...(categoryId ? { category_id: categoryId } : {}),
        }))
      )
      .select('id, player_id, is_captain');

    if (regError || !registrations) {
      if ((regError as any)?.code === '23505') {
        await rollback('Duplicate registration', regError);
        return {
          success: false,
          error: 'One of these players is already registered for this league',
        };
      }
      await rollback('Failed to create registrations', regError);
      return { success: false, error: 'Could not create the registrations' };
    }

    const captainRegistration = registrations.find((r: any) => r.is_captain);

    logger.info(
      `League team registered: team=${teamId} league=${leagueId} members=${memberIds.length} payment=${paymentId ?? 'free'}`
    );

    return {
      success: true,
      teamId,
      captainRegistrationId: captainRegistration?.id,
    };
  }

  /**
   * Swap one player out of a team for another.
   *
   * Blocked once the team has a completed match — otherwise a team could substitute a stronger
   * player after its results are already on the board.
   */
  async replaceTeamMember(params: {
    teamId: string;
    outgoingPlayerId: string;
    incomingPlayerId: string;
  }): Promise<{ success: boolean; avgDupr?: number | null; error?: string }> {
    const { teamId, outgoingPlayerId, incomingPlayerId } = params;

    const { data: team, error: teamError } = await supabase
      .from('league_teams')
      .select('id, league_id, captain_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return { success: false, error: 'Team not found' };
    }

    const { count: playedCount, error: matchError } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`);

    if (matchError) {
      logger.error('Could not check played matches:', matchError);
      return { success: false, error: 'Could not check the team\'s matches' };
    }

    if ((playedCount ?? 0) > 0) {
      return {
        success: false,
        error: 'This team has already played a match, so its players cannot be changed',
      };
    }

    // Current roster with the swap applied, re-validated as a whole.
    const { data: members, error: membersError } = await supabase
      .from('league_team_members')
      .select('id, player_id')
      .eq('team_id', teamId)
      .eq('status', 'active');

    if (membersError || !members) {
      return { success: false, error: 'Could not load the team roster' };
    }

    const outgoing = members.find((m: any) => m.player_id === outgoingPlayerId);
    if (!outgoing) {
      return { success: false, error: 'That player is not on this team' };
    }
    if (members.some((m: any) => m.player_id === incomingPlayerId)) {
      return { success: false, error: 'That player is already on this team' };
    }

    const newRoster = members
      .map((m: any) => m.player_id)
      .filter((id: string) => id !== outgoingPlayerId)
      .concat(incomingPlayerId);

    // The outgoing player's own registration is about to be freed, so exclude it from the
    // "already registered" check by removing it first inside the same flow.
    const { error: regDeleteError } = await supabase
      .from('league_registrations')
      .delete()
      .eq('team_id', teamId)
      .eq('player_id', outgoingPlayerId);

    if (regDeleteError) {
      logger.error('Failed to remove outgoing registration:', regDeleteError);
      return { success: false, error: 'Could not update the registration' };
    }

    const eligibility = await this.validateLeagueTeamEligibility(
      team.league_id,
      newRoster
    );

    if (!eligibility.ok) {
      // Put the outgoing player's registration back — the swap is refused.
      await supabase.from('league_registrations').insert({
        league_id: team.league_id,
        player_id: outgoingPlayerId,
        team_id: teamId,
        is_captain: outgoingPlayerId === team.captain_id,
        status: 'confirmed',
        payment_status: 'paid',
      });
      return { success: false, error: eligibility.reason };
    }

    // Swap the roster slot.
    const { error: swapError } = await supabase
      .from('league_team_members')
      .update({ player_id: incomingPlayerId })
      .eq('id', outgoing.id);

    if (swapError) {
      logger.error('Failed to swap team member:', swapError);
      return { success: false, error: 'Could not replace the player' };
    }

    // New registration for the incoming player. Per-player custom field answers are not
    // carried over: they belonged to the outgoing player.
    const { error: newRegError } = await supabase
      .from('league_registrations')
      .insert({
        league_id: team.league_id,
        player_id: incomingPlayerId,
        team_id: teamId,
        is_captain: false,
        status: 'confirmed',
        payment_status: 'paid',
        ...(eligibility.categoryId ? { category_id: eligibility.categoryId } : {}),
      });

    if (newRegError) {
      logger.error('Failed to register replacement player:', newRegError);
      return { success: false, error: 'Could not register the replacement player' };
    }

    await supabase
      .from('league_teams')
      .update({ avg_dupr_at_registration: eligibility.avgDupr })
      .eq('id', teamId);

    logger.info(
      `Team ${teamId}: replaced ${outgoingPlayerId} with ${incomingPlayerId}`
    );

    return { success: true, avgDupr: eligibility.avgDupr };
  }

  /**
   * Move the captain flag when a team's captain is reassigned.
   *
   * `league_teams.captain_id` is the source of truth; `league_registrations.is_captain` is a
   * denormalised copy used to decide which row holds team-scoped custom field answers. Without
   * this the two drift apart the moment an organizer changes the captain.
   */
  async syncCaptainFlag(
    teamId: string,
    newCaptainId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error: clearError } = await supabase
      .from('league_registrations')
      .update({ is_captain: false })
      .eq('team_id', teamId)
      .neq('player_id', newCaptainId);

    if (clearError) {
      logger.error('Failed to clear captain flags:', clearError);
      return { success: false, error: 'Could not update the captain' };
    }

    const { error: setError } = await supabase
      .from('league_registrations')
      .update({ is_captain: true })
      .eq('team_id', teamId)
      .eq('player_id', newCaptainId);

    if (setError) {
      logger.error('Failed to set captain flag:', setError);
      return { success: false, error: 'Could not update the captain' };
    }

    return { success: true };
  }

  /**
   * Withdraw a team: its registrations, its members, and the team itself.
   *
   * Frees the slot and releases the team name. Refunds stay manual through the existing refund
   * endpoints — the fee was a single payment, so it refunds as one.
   */
  async withdrawTeam(
    teamId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: team, error: teamError } = await supabase
      .from('league_teams')
      .select('id, name, league_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return { success: false, error: 'Team not found' };
    }

    const { count: playedCount } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`);

    if ((playedCount ?? 0) > 0) {
      return {
        success: false,
        error: 'This team has already played a match and cannot be withdrawn',
      };
    }

    // Field values cascade from league_registrations (ON DELETE CASCADE).
    const { error: regError } = await supabase
      .from('league_registrations')
      .delete()
      .eq('team_id', teamId);

    if (regError) {
      logger.error('Failed to delete team registrations:', regError);
      return { success: false, error: 'Could not remove the registrations' };
    }

    await supabase.from('league_team_members').delete().eq('team_id', teamId);

    const { error: deleteError } = await supabase
      .from('league_teams')
      .delete()
      .eq('id', teamId);

    if (deleteError) {
      logger.error('Failed to delete team:', deleteError);
      return { success: false, error: 'Could not remove the team' };
    }

    logger.info(`Team withdrawn: ${teamId} ("${team.name}")`);
    return { success: true };
  }

  /**
   * Teams that paid but whose registration never got created.
   *
   * Reconstructed from `pending_order_contexts`, NOT from Razorpay notes. Notes cap at 256
   * characters per value, which a team name plus several player ids will not fit — the existing
   * fetchMissingRegistrations rebuilds identities from notes and would show teams incompletely.
   * The full context is stored at order creation precisely so this case is recoverable.
   */
  async findMissingTeamRegistrations(leagueId: string): Promise<{
    success: boolean;
    missing: any[];
    error?: string;
  }> {
    const { data: pending, error } = await supabase
      .from('pending_order_contexts')
      .select('order_id, context, status, payment_id, created_at')
      .eq('entity_id', leagueId)
      .neq('status', 'processed');

    if (error) {
      logger.error('Failed to load pending order contexts:', error);
      return { success: false, missing: [], error: 'Could not load pending orders' };
    }

    const teamOrders = (pending || []).filter(
      (row: any) => row.context?.team_members
    );

    if (teamOrders.length === 0) {
      return { success: true, missing: [] };
    }

    const missing: any[] = [];

    for (const row of teamOrders as any[]) {
      let memberIds: string[] = [];
      try {
        memberIds = JSON.parse(row.context.team_members || '[]');
      } catch {
        memberIds = [];
      }

      // Skip anything that did land — a registration already exists for these players.
      const { data: existing } = await supabase
        .from('league_registrations')
        .select('id')
        .eq('league_id', leagueId)
        .in('player_id', memberIds.length > 0 ? memberIds : ['none'])
        .limit(1);

      if (existing && existing.length > 0) continue;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .in('id', memberIds.length > 0 ? memberIds : ['none']);

      missing.push({
        orderId: row.order_id,
        status: row.status,
        paymentId: row.payment_id,
        createdAt: row.created_at,
        teamName: row.context.team_name || null,
        captainId: row.context.player_id || null,
        members: (profiles || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
        })),
      });
    }

    return { success: true, missing };
  }

  /**
   * Re-run team creation from a stored order context.
   *
   * Safe to invoke twice: the unique index on (league_id, player_id) and the team-name index
   * make a duplicate impossible, and the context is marked processed on success.
   */
  async retryTeamRegistration(orderId: string): Promise<{
    success: boolean;
    teamId?: string;
    error?: string;
  }> {
    const { data: pending, error } = await supabase
      .from('pending_order_contexts')
      .select('order_id, context, status, payment_id')
      .eq('order_id', orderId)
      .single();

    if (error || !pending) {
      return { success: false, error: 'Order context not found' };
    }

    if (pending.status === 'processed') {
      return { success: false, error: 'This order has already been processed' };
    }

    const context: any = pending.context;
    if (!context?.team_members) {
      return { success: false, error: 'This order is not a team registration' };
    }

    let memberIds: string[] = [];
    try {
      memberIds = JSON.parse(context.team_members);
    } catch {
      return { success: false, error: 'Stored team list is unreadable' };
    }

    const eligibility = await this.validateLeagueTeamEligibility(
      context.id,
      memberIds
    );

    // Mirror the webhook: create as pending rather than refusing, so a paid team is never lost.
    const status = eligibility.ok ? 'confirmed' : 'pending';

    let categoryId = eligibility.categoryId;
    if (!categoryId) {
      const config = await this.getTeamLeagueConfig(context.id);
      categoryId = config.categoryId ?? null;
    }

    const created = await this.createLeagueTeamRegistration({
      leagueId: context.id,
      teamName: context.team_name || `Team ${String(context.player_id).slice(0, 8)}`,
      memberIds,
      captainId: context.player_id,
      categoryId,
      paymentId: pending.payment_id,
      avgDupr: eligibility.avgDupr,
      status,
    });

    if (!created.success) {
      return { success: false, error: created.error };
    }

    await supabase
      .from('pending_order_contexts')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('order_id', orderId);

    logger.info(`Retried team registration for order ${orderId} → team ${created.teamId}`);
    return { success: true, teamId: created.teamId };
  }
}

export const leagueTeamService = new LeagueTeamService();
