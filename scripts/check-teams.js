require('dotenv').config({ path: '../.env' });
const pool = require('../config/database');

async function checkTeams() {
    try {
        console.log('Checking teams in users table...');
        const result = await pool.query('SELECT id, email, role, team FROM users');
        console.log('Users found:', result.rows.length);
        console.log('Data:', JSON.stringify(result.rows, null, 2));

        const teams = await pool.query('SELECT DISTINCT team FROM users WHERE team IS NOT NULL AND team != \'\'');
        console.log('Distinct teams found:', teams.rows.map(r => r.team));

        if (teams.rows.length === 0) {
            console.log('No teams found. Seeding dummy teams...');
            // Update some users to have teams for testing
            // We'll try to find admin and give them Team A
            // And any other user Team B

            // Just update all admins to Team A for now if no teams exist
            await pool.query("UPDATE users SET team = 'Team A' WHERE role = 'admin'");
            console.log('Updated admins to Team A');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkTeams();
