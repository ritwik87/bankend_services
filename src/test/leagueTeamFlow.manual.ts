/**
 * Manual integration test for league team registration.
 *
 * Drives the real service layer against the TEST Supabase project, bypassing HTTP so it does
 * not depend on the frontend JWT signing issue. Creates its own throwaway league and removes
 * everything it made, so existing data is never mutated.
 *
 *   cd bankend_services && npx ts-node src/test/leagueTeamFlow.manual.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { supabase } from '../utils/supabase';
import { leagueTeamService } from '../services/leagueTeam.service';

const REAL_MICRO_LEAGUE = '0b4a4bad-fc1e-4a51-9141-b8093a659dde';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? `\n          ${detail}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const created: { leagueId?: string; teamIds: string[] } = { teamIds: [] };

  try {
    // ---------------------------------------------------------------- setup
    section('Setup');

    const { data: template } = await supabase
      .from('leagues')
      .select('organizer_id, sport_id')
      .eq('id', REAL_MICRO_LEAGUE)
      .single();

    const { data: category } = await supabase
      .from('league_category_settings')
      .select('category_id')
      .eq('league_id', REAL_MICRO_LEAGUE)
      .single();

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name: `ZZZ_TEST_TEAM_LEAGUE_${Date.now()}`,
        start_date: '2026-12-01',
        end_date: '2026-12-02',
        location: 'Test',
        organizer_id: template?.organizer_id,
        sport_id: template?.sport_id,
        max_teams: 8,
        max_team_members: 3,
        min_team_members: 3,
        registration_mode: 'team',
        max_avg_team_dupr: null, // no cap, so DUPR outage does not block creation tests
        registration_fee: 0,
        status: 'upcoming',
      })
      .select('id')
      .single();

    if (leagueError || !league) throw new Error(`Could not create test league: ${leagueError?.message}`);
    created.leagueId = league.id;
    console.log(`  test league: ${league.id}`);

    await supabase.from('league_category_settings').insert({
      league_id: league.id,
      category_id: category?.category_id,
      win_points: 2,
    });

    // Four unregistered dummy players.
    const { data: players } = await supabase
      .from('profiles')
      .select('id, name, phone')
      .like('phone', '9999999%')
      .eq('role', 'player')
      .limit(8);

    if (!players || players.length < 7) throw new Error('Need 7 dummy players');
    const [pA, pB, pC, pD, pE, pF, pG] = players;
    console.log(`  players: ${players.map((p: any) => p.name).join(', ')}`);

    const L = league.id;

    // ------------------------------------------------------- league config
    section('getTeamLeagueConfig');

    const cfg = await leagueTeamService.getTeamLeagueConfig(L);
    check('team-mode league accepted', cfg.ok === true, cfg.reason);
    check('single category resolved', !!cfg.categoryId);

    const indCfg = await leagueTeamService.getTeamLeagueConfig(
      '179c0f44-80ab-4a74-a5a1-0cc952a72b8b'
    );
    check(
      'individual-mode league rejected',
      indCfg.ok === false && /does not accept team/i.test(indCfg.reason || '')
    );

    // -------------------------------------------------------- player lookup
    section('lookupPlayerByPhone');

    const found = await leagueTeamService.lookupPlayerByPhone(
      (pA as any).phone.replace(/^\+91/, '')
    );
    check('existing player found by phone', found.found === true);
    check(
      'returns their stored profile name',
      found.player?.name === (pA as any).name,
      `got "${found.player?.name}" expected "${(pA as any).name}"`
    );

    const missing = await leagueTeamService.lookupPlayerByPhone('9111100000');
    check('unknown number returns found=false', missing.found === false);

    // ------------------------------------------------------ team name check
    section('checkTeamNameAvailable');

    const freeName = `Smashers_${Date.now()}`;
    const avail = await leagueTeamService.checkTeamNameAvailable(L, freeName);
    check('unused name is available', avail.available === true);

    const blank = await leagueTeamService.checkTeamNameAvailable(L, '   ');
    check('blank name rejected', blank.available === false);

    // -------------------------------------------------------- eligibility
    section('validateLeagueTeamEligibility');

    const tooFew = await leagueTeamService.validateLeagueTeamEligibility(L, [
      (pA as any).id,
      (pB as any).id,
    ]);
    check(
      'team below min_team_members rejected',
      tooFew.ok === false && /at least 3/i.test(tooFew.reason || ''),
      tooFew.reason
    );

    const dupes = await leagueTeamService.validateLeagueTeamEligibility(L, [
      (pA as any).id,
      (pA as any).id,
      (pB as any).id,
    ]);
    check(
      'duplicate player rejected',
      dupes.ok === false && /more than once/i.test(dupes.reason || ''),
      dupes.reason
    );

    const tooMany = await leagueTeamService.validateLeagueTeamEligibility(L, [
      (pA as any).id,
      (pB as any).id,
      (pC as any).id,
      (pD as any).id,
    ]);
    check(
      'team above max_team_members rejected',
      tooMany.ok === false && /at most 3/i.test(tooMany.reason || ''),
      tooMany.reason
    );

    const ok = await leagueTeamService.validateLeagueTeamEligibility(L, [
      (pA as any).id,
      (pB as any).id,
      (pC as any).id,
    ]);
    check('valid roster accepted (no DUPR cap)', ok.ok === true, ok.reason);
    check('category carried through', !!ok.categoryId);

    // ------------------------------------------------------------- create
    section('createLeagueTeamRegistration');

    const teamName = `Smashers_${Date.now()}`;
    const createRes = await leagueTeamService.createLeagueTeamRegistration({
      leagueId: L,
      teamName,
      memberIds: [(pA as any).id, (pB as any).id, (pC as any).id],
      captainId: (pA as any).id,
      categoryId: ok.categoryId,
      paymentId: null,
      avgDupr: null,
      status: 'confirmed',
    });

    check('team created', createRes.success === true, createRes.error);
    if (createRes.teamId) created.teamIds.push(createRes.teamId);
    check('captain registration id returned', !!createRes.captainRegistrationId);

    const { data: team } = await supabase
      .from('league_teams')
      .select('name, captain_id, owner_id, is_self_registered')
      .eq('id', createRes.teamId)
      .single();
    check('team name stored', (team as any)?.name === teamName);
    check('captain set', (team as any)?.captain_id === (pA as any).id);
    check('marked self-registered', (team as any)?.is_self_registered === true);

    const { data: mems } = await supabase
      .from('league_team_members')
      .select('player_id, role')
      .eq('team_id', createRes.teamId);
    check('3 members created', (mems || []).length === 3);
    check(
      'captain has captain role',
      (mems || []).find((m: any) => m.player_id === (pA as any).id)?.role === 'captain'
    );

    const { data: regs } = await supabase
      .from('league_registrations')
      .select('player_id, is_captain, team_id, category_id, status')
      .eq('team_id', createRes.teamId);
    check('3 registrations created', (regs || []).length === 3);
    check(
      'exactly one is_captain',
      (regs || []).filter((r: any) => r.is_captain).length === 1
    );
    check(
      'category_id set on every registration (win_points depends on it)',
      (regs || []).every((r: any) => !!r.category_id)
    );

    // ------------------------------------------------- duplicate name/player
    section('Duplicate guards');

    const takenNow = await leagueTeamService.checkTeamNameAvailable(
      L,
      teamName.toUpperCase()
    );
    check(
      'same name in different case is rejected',
      takenNow.available === false,
      takenNow.reason
    );

    const reuse = await leagueTeamService.validateLeagueTeamEligibility(L, [
      (pA as any).id,
      (pB as any).id,
      (pD as any).id,
    ]);
    check(
      'already-registered player rejected',
      reuse.ok === false && /already registered/i.test(reuse.reason || ''),
      reuse.reason
    );

    const dupTeam = await leagueTeamService.createLeagueTeamRegistration({
      leagueId: L,
      teamName: `${teamName}_other`,
      memberIds: [(pA as any).id, (pD as any).id, (pB as any).id],
      captainId: (pD as any).id,
      categoryId: ok.categoryId,
      paymentId: null,
      avgDupr: null,
      status: 'confirmed',
    });
    check(
      'unique index blocks a player joining two teams',
      dupTeam.success === false,
      dupTeam.error
    );
    if (dupTeam.teamId) created.teamIds.push(dupTeam.teamId);

    const { data: orphans } = await supabase
      .from('league_teams')
      .select('id')
      .eq('league_id', L)
      .eq('name', `${teamName}_other`);
    check(
      'failed creation rolled back, no orphan team',
      (orphans || []).length === 0
    );

    // ------------------------------------------------- shared DUPR ID guard
    section('Duplicate DUPR ID across members');

    // Give two untouched players the same DUPR ID, then restore them afterwards.
    const { data: beforeDupr } = await supabase
      .from('profiles')
      .select('id, dupr_id')
      .in('id', [(pE as any).id, (pF as any).id]);

    await supabase
      .from('profiles')
      .update({ dupr_id: 'SHARED1' })
      .in('id', [(pE as any).id, (pF as any).id]);

    const shared = await leagueTeamService.validateLeagueTeamEligibility(L, [
      (pE as any).id,
      (pF as any).id,
      (pG as any).id,
    ]);
    console.log(`  shared-DUPR result: ok=${shared.ok} reason="${shared.reason}"`);
    check(
      'two members sharing a DUPR ID are rejected',
      shared.ok === false && /more than one player/i.test(shared.reason || ''),
      shared.reason
    );

    // Case and whitespace must not defeat the check.
    await supabase
      .from('profiles')
      .update({ dupr_id: ' shared1 ' })
      .eq('id', (pF as any).id);

    const sharedCase = await leagueTeamService.validateLeagueTeamEligibility(L, [
      (pE as any).id,
      (pF as any).id,
      (pG as any).id,
    ]);
    check(
      'case and whitespace differences still count as the same DUPR ID',
      sharedCase.ok === false && /more than one player/i.test(sharedCase.reason || ''),
      sharedCase.reason
    );

    for (const row of beforeDupr || []) {
      await supabase
        .from('profiles')
        .update({ dupr_id: (row as any).dupr_id })
        .eq('id', (row as any).id);
    }
    console.log('  original dupr_id values restored');

    // -------------------------------------------------------- DUPR cap path
    section('DUPR cap (fail-closed behaviour)');

    await supabase.from('leagues').update({ max_avg_team_dupr: 4.0 }).eq('id', L);
    // Three players untouched by every test above, so the only thing that can refuse this
    // roster is the DUPR verification itself. Using already-registered players here would
    // make the check pass for the wrong reason and prove nothing about the cap.
    const capped = await leagueTeamService.validateLeagueTeamEligibility(L, [
      (pE as any).id,
      (pF as any).id,
      (pG as any).id,
    ]);
    console.log(`  cap result: ok=${capped.ok} reason="${capped.reason}"`);
    check(
      'the refusal is about DUPR, not an earlier rule',
      /dupr|verify|rating/i.test(capped.reason || ''),
      `reason was "${capped.reason}" — the cap path was never exercised`
    );
    check(
      'with a cap set, an unverifiable team is refused rather than allowed',
      capped.ok === false,
      'A pass here would mean ratings were skipped or defaulted'
    );
    await supabase.from('leagues').update({ max_avg_team_dupr: null }).eq('id', L);

    // ------------------------------------------------------------ withdraw
    section('withdrawTeam');

    const wd = await leagueTeamService.withdrawTeam(createRes.teamId as string);
    check('team withdrawn', wd.success === true, wd.error);

    const { data: afterRegs } = await supabase
      .from('league_registrations')
      .select('id')
      .eq('team_id', createRes.teamId);
    check('registrations removed', (afterRegs || []).length === 0);

    const { data: afterTeam } = await supabase
      .from('league_teams')
      .select('id')
      .eq('id', createRes.teamId);
    check('team row removed', (afterTeam || []).length === 0);

    const freedName = await leagueTeamService.checkTeamNameAvailable(L, teamName);
    check('team name freed after withdrawal', freedName.available === true);
  } finally {
    // ------------------------------------------------------------- cleanup
    section('Cleanup');
    if (created.leagueId) {
      await supabase.from('league_registrations').delete().eq('league_id', created.leagueId);
      for (const t of created.teamIds) {
        await supabase.from('league_team_members').delete().eq('team_id', t);
      }
      await supabase.from('league_teams').delete().eq('league_id', created.leagueId);
      await supabase.from('league_category_settings').delete().eq('league_id', created.leagueId);
      await supabase.from('leagues').delete().eq('id', created.leagueId);
      console.log('  test league and all its rows removed');
    }

    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    if (failures.length) {
      console.log('Failed checks:');
      failures.forEach((f) => console.log(`  - ${f}`));
    }
    process.exit(fail === 0 ? 0 : 1);
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
