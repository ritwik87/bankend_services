import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ✅ Load Supabase Admin client (use your service role key!)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Main function to create league teams with members
 * @param {string} leagueId - UUID of the league
 */
async function createLeagueTeams(leagueId) {
  console.log(`\n🏆 Starting bulk team creation for league: ${leagueId}\n`);

  try {
    // Step 1: Fetch league details to get max_teams and max_team_members
    console.log('📋 Fetching league details...');
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, max_teams, max_team_members, organizer_id')
      .eq('id', leagueId)
      .single();

    if (leagueError) {
      throw new Error(`Failed to fetch league: ${leagueError.message}`);
    }

    if (!league) {
      throw new Error('League not found!');
    }

    console.log(`✅ League: ${league.name}`);
    console.log(`   Max Teams: ${league.max_teams}`);
    console.log(`   Max Players per Team: ${league.max_team_members}\n`);

    // Step 2: Fetch all confirmed league registrations
    console.log('📋 Fetching confirmed league registrations...');
    const { data: registrations, error: regError } = await supabase
      .from('league_registrations')
      .select(`
        id,
        player_id,
        registration_date,
        profiles:player_id (
          id,
          name,
          email,
          dupr_id
        )
      `)
      .eq('league_id', leagueId)
      .eq('status', 'confirmed')
      .eq('payment_status', 'paid')
      .order('registration_date', { ascending: true });

    if (regError) {
      throw new Error(`Failed to fetch registrations: ${regError.message}`);
    }

    if (!registrations || registrations.length === 0) {
      console.log('⚠️  No confirmed registrations found for this league.');
      return;
    }

    console.log(`✅ Found ${registrations.length} confirmed registrations\n`);

    // Step 3: Collect all registered players (no partners - decided manually)
    const allPlayers = [];
    const playerSet = new Set();

    for (const reg of registrations) {
      // Add only the registered player
      if (reg.player_id && !playerSet.has(reg.player_id)) {
        playerSet.add(reg.player_id);
        allPlayers.push({
          id: reg.player_id,
          name: reg.profiles?.name || 'Unknown Player',
          email: reg.profiles?.email,
          dupr_id: reg.profiles?.dupr_id,
          registration_date: reg.registration_date,
        });
      }
    }

    console.log(`👥 Total registered players: ${allPlayers.length}\n`);

    // Step 4: Distribute players across teams
    const teamsToCreate = Math.min(league.max_teams, Math.ceil(allPlayers.length / league.max_team_members));
    const playersPerTeam = Math.ceil(allPlayers.length / teamsToCreate);

    console.log(`📊 Distribution Plan:`);
    console.log(`   Creating ${teamsToCreate} teams`);
    console.log(`   ~${playersPerTeam} players per team\n`);

    // Step 5: Create teams and assign members
    let playerIndex = 0;
    const createdTeams = [];

    for (let teamNum = 1; teamNum <= teamsToCreate; teamNum++) {
      const teamName = `Team ${teamNum}`;

      console.log(`\n🔨 Creating ${teamName}...`);

      // Create the team
      const { data: newTeam, error: teamError } = await supabase
        .from('league_teams')
        .insert({
          league_id: leagueId,
          name: teamName,
          description: `Auto-generated team ${teamNum} for ${league.name}`,
          owner_id: league.organizer_id,
          captain_id: null, // Will be set to first team member
          status: 'active',
        })
        .select()
        .single();

      if (teamError) {
        console.error(`   ❌ Failed to create ${teamName}: ${teamError.message}`);
        continue;
      }

      console.log(`   ✅ Created ${teamName} (ID: ${newTeam.id})`);
      createdTeams.push(newTeam);

      // Add members to this team
      const teamMembers = [];
      const membersToAdd = Math.min(playersPerTeam, allPlayers.length - playerIndex);

      for (let i = 0; i < membersToAdd; i++) {
        const player = allPlayers[playerIndex++];

        teamMembers.push({
          team_id: newTeam.id,
          player_id: player.id,
          role: i === 0 ? 'captain' : 'player', // First member is captain
          status: 'active',
        });
      }

      // Insert all team members
      const { data: insertedMembers, error: membersError } = await supabase
        .from('league_team_members')
        .insert(teamMembers)
        .select();

      if (membersError) {
        console.error(`   ❌ Failed to add members to ${teamName}: ${membersError.message}`);
        continue;
      }

      console.log(`   ✅ Added ${insertedMembers.length} members to ${teamName}`);

      // Update team captain_id
      if (insertedMembers.length > 0) {
        const captainMember = insertedMembers.find(m => m.role === 'captain');
        if (captainMember) {
          await supabase
            .from('league_teams')
            .update({ captain_id: captainMember.player_id })
            .eq('id', newTeam.id);

          console.log(`   👑 Set captain: ${allPlayers.find(p => p.id === captainMember.player_id)?.name}`);
        }
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    }

    // Step 6: Summary
    console.log(`\n\n✅ ====== BULK TEAM CREATION COMPLETE ======`);
    console.log(`   League: ${league.name}`);
    console.log(`   Teams Created: ${createdTeams.length}`);
    console.log(`   Players Assigned: ${playerIndex}`);
    console.log(`   Players Remaining: ${allPlayers.length - playerIndex}`);

    if (allPlayers.length - playerIndex > 0) {
      console.log(`\n⚠️  Warning: ${allPlayers.length - playerIndex} players could not be assigned (exceeds max_teams limit)`);
    }

    console.log(`\n📋 Created Teams:`);
    for (const team of createdTeams) {
      const { data: memberCount } = await supabase
        .from('league_team_members')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', team.id);

      console.log(`   - ${team.name}: ${memberCount || 0} members`);
    }

    console.log(`\n🎉 All done!\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// ✅ Get league ID from command line argument
const leagueId = process.argv[2];

if (!leagueId) {
  console.error('❌ Please provide a league ID as argument:');
  console.error('   node createLeagueTeams.js <league-id>');
  process.exit(1);
}

// Run the function
createLeagueTeams(leagueId);
