/**
 * Clean and standardize team data
 * Format: 'A', 'B', 'C' (short format)
 */
require('dotenv').config();
const pool = require('../config/database');

async function cleanTeamData() {
    const client = await pool.connect();

    try {
        console.log('=====================================');
        console.log('   CLEANING TEAM DATA');
        console.log('=====================================\n');

        await client.query('BEGIN');

        // 1. Clean USERS table
        console.log('📋 Cleaning USERS table...');
        console.log('─────────────────────────────────────');

        // Team A → A
        const userTeamA = await client.query(`
            UPDATE users SET team = 'A' 
            WHERE team IN ('Team A', 'team a', 'team A', 'TEAM A')
            RETURNING id, email, team
        `);
        console.log(`  ✅ Updated ${userTeamA.rowCount} users to team 'A'`);

        // Team B → B
        const userTeamB = await client.query(`
            UPDATE users SET team = 'B' 
            WHERE team IN ('Team B', 'team b', 'team B', 'TEAM B')
            RETURNING id, email, team
        `);
        console.log(`  ✅ Updated ${userTeamB.rowCount} users to team 'B'`);

        // Team C → C
        const userTeamC = await client.query(`
            UPDATE users SET team = 'C' 
            WHERE team IN ('Team C', 'team c', 'team C', 'TEAM C')
            RETURNING id, email, team
        `);
        console.log(`  ✅ Updated ${userTeamC.rowCount} users to team 'C'`);

        // Admin Team → NULL (admin doesn't need team)
        const adminTeam = await client.query(`
            UPDATE users SET team = NULL 
            WHERE team IN ('Admin Team', 'admin', 'Admin')
            RETURNING id, email, role
        `);
        console.log(`  ✅ Set ${adminTeam.rowCount} admin users team to NULL`);

        // 2. Clean PROPERTIES table
        console.log('\n📋 Cleaning PROPERTIES table...');
        console.log('─────────────────────────────────────');

        // Team A → A
        const propTeamA = await client.query(`
            UPDATE properties SET agent_team = 'A' 
            WHERE agent_team IN ('Team A', 'team a', 'team A', 'TEAM A')
        `);
        console.log(`  ✅ Updated ${propTeamA.rowCount} properties to agent_team 'A'`);

        // Team B → B
        const propTeamB = await client.query(`
            UPDATE properties SET agent_team = 'B' 
            WHERE agent_team IN ('Team B', 'team b', 'team B', 'TEAM B')
        `);
        console.log(`  ✅ Updated ${propTeamB.rowCount} properties to agent_team 'B'`);

        // Team C → C
        const propTeamC = await client.query(`
            UPDATE properties SET agent_team = 'C' 
            WHERE agent_team IN ('Team C', 'team c', 'team C', 'TEAM C')
        `);
        console.log(`  ✅ Updated ${propTeamC.rowCount} properties to agent_team 'C'`);

        await client.query('COMMIT');

        // 3. Verify results
        console.log('\n📋 VERIFICATION:');
        console.log('─────────────────────────────────────');

        const usersResult = await pool.query(`
            SELECT team, COUNT(*) as count FROM users GROUP BY team ORDER BY team
        `);
        console.log('\nUsers by team:');
        usersResult.rows.forEach(r => console.log(`  ${r.team || 'NULL'}: ${r.count}`));

        const propsResult = await pool.query(`
            SELECT agent_team, COUNT(*) as count FROM properties GROUP BY agent_team ORDER BY agent_team
        `);
        console.log('\nProperties by agent_team:');
        propsResult.rows.forEach(r => console.log(`  ${r.agent_team || 'NULL'}: ${r.count}`));

        console.log('\n✅ Team data cleaned successfully!');
        console.log('=====================================');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

cleanTeamData().catch(console.error);
