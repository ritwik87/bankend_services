import { createHmac, timingSafeEqual } from 'crypto';
import { supabase } from '../utils/supabase';
import logger from '../utils/logger';
import { phoneOrCondition } from '../utils/helper';
import { getHumanCheckSecret } from './humanCheck.service';
import { userService } from './user.service';
import { paymentService } from './payment.service';
import { leaguePlayerCategoryService } from './leaguePlayerCategory.service';

/**
 * Registration-only access to an individual league for someone who is not logged in.
 *
 * The visitor gives a phone number and passes a human check — nothing proves they own that
 * number. So this deliberately does NOT create a Supabase session: the only thing the returned
 * guest token can do is register that one player for that one league (and pay for it). It
 * cannot read or change the account, and staff accounts (admin / organizer / umpire) are refused.
 */

const GUEST_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
/** Roles that may register through the phone + human check path. Everything else must log in. */
const GUEST_ALLOWED_ROLES = ['player', 'guest'];

const STAFF_NUMBER_ERROR =
  'This number belongs to a staff account. Please log in to register.';

type GuestTokenPayload = { pid: string; lid: string; exp: number };

const sign = (payload: string) =>
  createHmac('sha256', getHumanCheckSecret()).update(`league-guest.${payload}`).digest('hex');

export function createGuestToken(playerId: string, leagueId: string): string {
  const body = Buffer.from(
    JSON.stringify({ pid: playerId, lid: leagueId, exp: Date.now() + GUEST_TOKEN_TTL_MS })
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyGuestToken(
  token: unknown,
  leagueId: string
): { playerId: string } | null {
  try {
    const [body, sig] = String(token ?? '').split('.');
    if (!body || !sig) return null;
    const expected = Buffer.from(sign(body));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as GuestTokenPayload;
    if (payload.lid !== leagueId || !(payload.exp > Date.now())) return null;
    return { playerId: payload.pid };
  } catch {
    return null;
  }
}

type Fail = { ok: false; status: number; error: string };

class LeagueGuestService {
  /** The league must be an open, individual-mode league that does not need a logged-in account. */
  async getOpenIndividualLeague(
    leagueId: string
  ): Promise<{ ok: true; league: any } | Fail> {
    const { data: league } = await supabase
      .from('leagues')
      .select(
        'id, name, status, start_date, registration_deadline, registration_fee, registration_mode, require_dupr_premium, terms_and_conditions, organizer_id'
      )
      .eq('id', leagueId)
      .maybeSingle();

    if (!league) return { ok: false, status: 404, error: 'League not found' };
    if (league.registration_mode === 'team') {
      return { ok: false, status: 400, error: 'Team leagues require logging in' };
    }
    if (league.require_dupr_premium) {
      return {
        ok: false,
        status: 403,
        error: 'This league needs a DUPR+ subscription — please log in to register',
      };
    }
    if (!['upcoming', 'active'].includes(String(league.status).toLowerCase())) {
      return { ok: false, status: 400, error: 'Registration is not open for this league' };
    }
    if (
      league.registration_deadline &&
      new Date(league.registration_deadline) < new Date(new Date().toDateString())
    ) {
      return { ok: false, status: 400, error: 'Registration has closed for this league' };
    }
    if (!(new Date(league.start_date) > new Date())) {
      return { ok: false, status: 400, error: 'Registration has closed for this league' };
    }
    return { ok: true, league };
  }

  async isAlreadyRegistered(leagueId: string, playerId: string): Promise<boolean> {
    const { data } = await supabase
      .from('league_registrations')
      .select('id')
      .eq('league_id', leagueId)
      .eq('player_id', playerId)
      .limit(1);
    return !!data && data.length > 0;
  }

  /**
   * Find the player for this phone number, or — when none exists — create one from `name`.
   * Returns only the handful of profile fields the form pre-fills; no email, DOB or photo.
   */
  async identify(
    leagueId: string,
    phone: string,
    name?: string
  ): Promise<
    | Fail
    | { ok: true; needsName: true }
    | {
        ok: true;
        needsName?: false;
        guestToken: string;
        isNew: boolean;
        alreadyRegistered: boolean;
        profile: Record<string, any>;
      }
  > {
    const config = await this.getOpenIndividualLeague(leagueId);
    if (!config.ok) return config;

    const { data: found } = await supabase
      .from('profiles')
      .select('id, name, phone, role, gender, tshirt_size, dupr_id, age')
      .or(phoneOrCondition(phone));

    // If ANY profile on this number is not a plain player (admin, organizer, umpire, or an
    // unknown role), refuse — never fall through to a duplicate player profile on the same number.
    if ((found || []).some((p: any) => !GUEST_ALLOWED_ROLES.includes(String(p.role)))) {
      return { ok: false, status: 403, error: STAFF_NUMBER_ERROR };
    }

    let profile: any = found?.[0];
    let isNew = false;

    if (!profile) {
      if (!name || name.trim().length < 2) return { ok: true, needsName: true };
      const created = await userService.bulkRegisterUser({
        phone,
        userData: {
          name: name.trim(),
          // Same synthesis the admin bulk upload and team teammate flows use.
          email: `${phone}@gmail.com`,
          role: 'player',
        },
      });
      if (!created.success || !created.user) {
        return {
          ok: false,
          status: 400,
          error: created.error || created.message || 'Could not create your player profile',
        };
      }
      profile = created.user;
      isNew = !created.isExisting;
      // bulkRegisterUser returns an existing profile if one appeared meanwhile — re-check its role
      if (!GUEST_ALLOWED_ROLES.includes(String(profile.role ?? 'player'))) {
        return { ok: false, status: 403, error: STAFF_NUMBER_ERROR };
      }
    }

    const alreadyRegistered = await this.isAlreadyRegistered(leagueId, profile.id);

    return {
      ok: true,
      guestToken: createGuestToken(profile.id, leagueId),
      isNew,
      alreadyRegistered,
      profile: {
        name: profile.name ?? '',
        phone: profile.phone ?? phone,
        gender: profile.gender ?? null,
        tshirt_size: profile.tshirt_size ?? null,
        dupr_id: profile.dupr_id ?? null,
        age: profile.age ?? null,
      },
    };
  }

  /** Keep only answers for this league's own fields, as trimmed strings of sane length. */
  private async cleanFieldValues(
    leagueId: string,
    values: Record<string, unknown> | undefined
  ): Promise<Record<string, string>> {
    const { data: fields } = await supabase
      .from('league_custom_fields_with_options')
      .select('id')
      .eq('league_id', leagueId);
    const allowed = new Set((fields || []).map((f: any) => f.id));
    const out: Record<string, string> = {};
    Object.entries(values || {}).forEach(([id, v]) => {
      if (allowed.has(id) && typeof v === 'string' && v.trim()) out[id] = v.slice(0, 2000);
    });
    return out;
  }

  private async recordTerms(league: any, playerId: string, userAgent?: string) {
    if (!league.terms_and_conditions?.trim()) return;
    const { error } = await supabase.rpc('accept_terms', {
      p_user_id: playerId,
      p_tournament_id: null,
      p_league_id: league.id,
      p_ip_address: null,
      p_user_agent: userAgent || null,
      p_terms_version: '1.0',
    });
    if (error) logger.warn('Guest terms acceptance not recorded:', error.message);
  }

  /** Paid league: create the Razorpay order. The amount comes from the league, never the client. */
  async createOrder(
    leagueId: string,
    guestToken: string,
    fieldValues: Record<string, unknown> | undefined,
    termsAccepted: boolean,
    userAgent?: string
  ): Promise<Fail | { ok: true; order: any }> {
    const auth = verifyGuestToken(guestToken, leagueId);
    if (!auth) return { ok: false, status: 401, error: 'Your session expired — please start again' };

    const config = await this.getOpenIndividualLeague(leagueId);
    if (!config.ok) return config;
    const { league } = config;

    const fee = Number(league.registration_fee || 0);
    if (!(fee > 0)) return { ok: false, status: 400, error: 'This league is free to register' };
    if (league.terms_and_conditions?.trim() && !termsAccepted) {
      return { ok: false, status: 400, error: 'Please accept the terms and conditions' };
    }
    if (await this.isAlreadyRegistered(leagueId, auth.playerId)) {
      return { ok: false, status: 409, error: 'You are already registered for this league' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, phone')
      .eq('id', auth.playerId)
      .maybeSingle();

    const cleaned = await this.cleanFieldValues(leagueId, fieldValues);
    const isImageUrl = (v: string) =>
      v.startsWith('http') || /\.(jpe?g|png|gif|webp|svg)$/i.test(v);
    const playerFieldsJson = JSON.stringify(Object.values(cleaned).filter((v) => !isImageUrl(v)));

    await this.recordTerms(league, auth.playerId, userAgent);

    const result = await paymentService.createOrder({
      amount: Math.round(fee * 100),
      currency: 'INR',
      receipt: `${leagueId}_${Date.now()}`.substring(0, 40),
      notes: {
        platform: 'tournament_management',
        league_id: leagueId,
        player_id: auth.playerId,
        player_name: profile?.name || '',
        player_phone: profile?.phone || '',
        player_fields: playerFieldsJson.length <= 256 ? playerFieldsJson : '',
      },
      context: {
        type: 'league',
        id: leagueId,
        player_id: auth.playerId,
        custom_field_values: JSON.stringify(cleaned),
      },
      entity_id: leagueId,
    } as any);

    if (!result.success || !result.order) {
      return { ok: false, status: 400, error: result.error || 'Failed to create payment order' };
    }
    return { ok: true, order: result.order };
  }

  /** Free league: create the registration, save the answers and assign the player category. */
  async registerFree(
    leagueId: string,
    guestToken: string,
    fieldValues: Record<string, unknown> | undefined,
    fieldMetadata: Record<string, unknown> | undefined,
    termsAccepted: boolean,
    userAgent?: string
  ): Promise<Fail | { ok: true; registrationId: string }> {
    const auth = verifyGuestToken(guestToken, leagueId);
    if (!auth) return { ok: false, status: 401, error: 'Your session expired — please start again' };

    const config = await this.getOpenIndividualLeague(leagueId);
    if (!config.ok) return config;
    const { league } = config;

    if (Number(league.registration_fee || 0) > 0) {
      return { ok: false, status: 400, error: 'This league needs payment' };
    }
    if (league.terms_and_conditions?.trim() && !termsAccepted) {
      return { ok: false, status: 400, error: 'Please accept the terms and conditions' };
    }
    if (await this.isAlreadyRegistered(leagueId, auth.playerId)) {
      return { ok: false, status: 409, error: 'You are already registered for this league' };
    }

    await this.recordTerms(league, auth.playerId, userAgent);

    const { data: registration, error } = await supabase
      .from('league_registrations')
      .insert({
        league_id: leagueId,
        player_id: auth.playerId,
        status: 'confirmed',
        payment_status: 'confirmed', // same value the logged-in free flow writes
      })
      .select('id')
      .single();
    if (error || !registration) {
      logger.error('Guest free league registration failed:', error);
      return { ok: false, status: 500, error: 'Could not complete your registration' };
    }

    const cleaned = await this.cleanFieldValues(leagueId, fieldValues);
    const rows = Object.entries(cleaned).map(([field_id, field_value]) => ({
      registration_id: registration.id,
      field_id,
      field_value,
      field_metadata: (fieldMetadata as any)?.[field_id] ?? null,
    }));
    if (rows.length > 0) {
      const { error: fieldError } = await supabase
        .from('league_registration_field_values')
        .insert(rows);
      if (fieldError) logger.error('Guest registration: saving custom fields failed:', fieldError);
    }

    await leaguePlayerCategoryService.assignForPlayer(leagueId, auth.playerId);
    return { ok: true, registrationId: registration.id };
  }

  /** After paying, the browser polls this until the webhook has created the registration. */
  async paymentStatus(
    leagueId: string,
    guestToken: string,
    paymentId: string
  ): Promise<Fail | { ok: true; registered: boolean }> {
    const auth = verifyGuestToken(guestToken, leagueId);
    if (!auth) return { ok: false, status: 401, error: 'Your session expired' };
    const { data } = await supabase
      .from('league_registrations')
      .select('id')
      .eq('league_id', leagueId)
      .eq('player_id', auth.playerId)
      .eq('payment_id', paymentId)
      .limit(1);
    return { ok: true, registered: !!data && data.length > 0 };
  }
}

export const leagueGuestService = new LeagueGuestService();
