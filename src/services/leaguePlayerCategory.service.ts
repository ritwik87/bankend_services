import { supabase } from '../utils/supabase';
import logger from '../utils/logger';

export type LeaguePlayerCategory = 'pro' | 'advanced' | 'intermediate';

/**
 * Map a gender + DUPR rating to a league player category.
 *   Men:   Pro 4.7+, Advanced 4.2–4.7, Intermediate below 4.2
 *   Women: Advanced 4.0+, Intermediate below 4.0
 * Returns null when gender is not male/female — the organizer assigns those by hand.
 */
export function categoryFromRating(
  gender: string | null | undefined,
  rating: number
): LeaguePlayerCategory | null {
  const g = String(gender ?? '').trim().toLowerCase();
  if (g === 'male') {
    if (rating >= 4.7) return 'pro';
    if (rating >= 4.2) return 'advanced';
    return 'intermediate';
  }
  if (g === 'female') {
    return rating >= 4.0 ? 'advanced' : 'intermediate';
  }
  return null;
}

/** The higher of singles / doubles, or null when neither is a usable number. */
function bestRating(...values: unknown[]): number | null {
  const nums = values
    .map((v) => (v === null || v === undefined || v === '' ? NaN : Number(v)))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.max(...nums) : null;
}

class LeaguePlayerCategoryService {
  /**
   * Assign the player's category for an individual league from their registration answers.
   *
   * Rating source, in order: the league's "DUPR Rating" custom field (auto-filled from DUPR with
   * the higher of singles/doubles, or typed by the player when DUPR was unreachable), then the
   * rating cached on the profile. An existing assignment is never overwritten — an organizer may
   * have set it, with a base price, by hand.
   *
   * Never throws: this runs after money is taken, so a failure here must not fail the webhook.
   */
  async assignForPlayer(
    leagueId: string,
    playerId: string
  ): Promise<{ assigned: boolean; category?: LeaguePlayerCategory; reason?: string }> {
    try {
      const { data: existing } = await supabase
        .from('league_player_categories')
        .select('id')
        .eq('league_id', leagueId)
        .eq('player_id', playerId)
        .maybeSingle();
      if (existing) return { assigned: false, reason: 'already assigned' };

      const [{ data: fields }, { data: profile }, { data: registration }] =
        await Promise.all([
          supabase
            .from('league_custom_fields')
            .select('id, field_name, profile_field_name')
            .eq('league_id', leagueId),
          supabase
            .from('profiles')
            .select('gender, dupr_player_data')
            .eq('id', playerId)
            .maybeSingle(),
          supabase
            .from('league_registrations')
            .select('id')
            .eq('league_id', leagueId)
            .eq('player_id', playerId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      if (!registration) return { assigned: false, reason: 'no registration' };

      const ratingFieldId = fields?.find((f) => f.field_name === 'dupr_rating')?.id;
      // Opt-in per league: only leagues that added a "DUPR Rating" custom field get auto-categories
      if (!ratingFieldId) return { assigned: false, reason: 'league has no dupr_rating field' };
      const genderFieldId = fields?.find(
        (f) => f.profile_field_name === 'gender' || f.field_name === 'gender'
      )?.id;

      const { data: answers } = await supabase
        .from('league_registration_field_values')
        .select('field_id, field_value')
        .eq('registration_id', registration.id);
      const answer = (id?: string) =>
        id ? answers?.find((a) => a.field_id === id)?.field_value : undefined;

      const ratings = (profile as any)?.dupr_player_data?.ratings;
      const rating =
        bestRating(answer(ratingFieldId)) ??
        bestRating(ratings?.singles, ratings?.doubles);
      if (rating === null) return { assigned: false, reason: 'no rating' };

      const category = categoryFromRating(
        answer(genderFieldId) || (profile as any)?.gender,
        rating
      );
      if (!category) return { assigned: false, reason: 'gender not male/female' };

      const { error } = await supabase
        .from('league_player_categories')
        .upsert(
          { league_id: leagueId, player_id: playerId, category, base_price: 0 },
          { onConflict: 'league_id,player_id', ignoreDuplicates: true }
        );
      if (error) throw error;

      logger.info('League player category assigned', {
        leagueId,
        playerId,
        rating,
        category,
      });
      return { assigned: true, category };
    } catch (error) {
      logger.error('Failed to assign league player category', {
        leagueId,
        playerId,
        error,
      });
      return { assigned: false, reason: 'error' };
    }
  }
}

export const leaguePlayerCategoryService = new LeaguePlayerCategoryService();
