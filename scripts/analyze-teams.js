/**
 * Analyze team data in database
 */
require('dotenv').config();
const pool = require('../config/database');

async function checkTeams() {
    console.log('=====================================');
    console.log('   TEAM DATA ANALYSIS');
    console.log('=====================================\n');

    // 1. Users team data
    console.log('📋 USERS TABLE - team values:');
    console.log('─────────────────────────────────────');
    const usersTeams = await pool.query(`
        SELECT team, COUNT(*) as count, 
               array_agg(DISTINCT email) as emails
        FROM users 
        GROUP BY team 
        ORDER BY team
    `);
    usersTeams.rows.forEach(row => {
        console.log(`  Team: '${row.team}' → ${row.count} user(s): ${row.emails.slice(0, 3).join(', ')}`);
    });

    // 2. Properties agent_team data
    console.log('\n📋 PROPERTIES TABLE - agent_team values:');
    console.log('─────────────────────────────────────');
    const propsTeams = await pool.query(`
        SELECT agent_team, COUNT(*) as count
        FROM properties 
        GROUP BY agent_team 
        ORDER BY agent_team
    `);
    propsTeams.rows.forEach(row => {
        console.log(`  agent_team: '${row.agent_team}' → ${row.count} properties`);
    });

    // 3. Check for mismatches
    console.log('\n⚠️  POTENTIAL ISSUES:');
    console.log('─────────────────────────────────────');

    // Get distinct values
    const userTeamValues = usersTeams.rows.map(r => r.team).filter(t => t);
    const propTeamValues = propsTeams.rows.map(r => r.agent_team).filter(t => t);

    // Find teams in properties but not in users
    const orphanTeams = propTeamValues.filter(t => !userTeamValues.includes(t));
    if (orphanTeams.length > 0) {
        console.log(`  ❌ Teams in properties but NOT in users: ${orphanTeams.join(', ')}`);
    }

    // Check for inconsistent formats
    const allTeams = [...new Set([...userTeamValues, ...propTeamValues])];
    console.log(`  All unique team values: ${allTeams.join(', ')}`);

    // Check for null/empty
    const nullUsers = usersTeams.rows.find(r => r.team === null);
    const nullProps = propsTeams.rows.find(r => r.agent_team === null);
    if (nullUsers) console.log(`  ⚠️  ${nullUsers.count} users have NULL team`);
    if (nullProps) console.log(`  ⚠️  ${nullProps.count} properties have NULL agent_team`);

    // 4. Sample data
    console.log('\n📋 SAMPLE USER DATA:');
    console.log('─────────────────────────────────────');
    const sampleUsers = await pool.query('SELECT id, email, role, team FROM users ORDER BY id LIMIT 10');
    console.table(sampleUsers.rows);

    console.log('\n📋 SAMPLE PROPERTIES DATA (agent_team):');
    console.log('─────────────────────────────────────');
    const sampleProps = await pool.query('SELECT id, property_id, agent_team, approve_status FROM properties ORDER BY id LIMIT 10');
    console.table(sampleProps.rows);

    await pool.end();
}

checkTeams().catch(console.error);
