
require('dotenv').config({ path: '../.env' });
const pool = require('../config/database');

async function analyze() {
    try {
        console.log('--- TYPES in Properties ---');
        const types = await pool.query('SELECT DISTINCT type FROM properties');
        console.log(types.rows.map(r => r.type));

        console.log('\n--- MASTER TYPES ---');
        const masterTypes = await pool.query('SELECT name FROM master_types');
        console.log(masterTypes.rows.map(r => r.name));

        console.log('\n--- AGENT TEAMS in Properties ---');
        const teams = await pool.query('SELECT DISTINCT agent_team FROM properties');
        console.log(teams.rows.map(r => r.agent_team));

        console.log('\n--- APPROVE STATUS in Properties ---');
        const status = await pool.query('SELECT DISTINCT approve_status FROM properties');
        console.log(status.rows.map(r => r.approve_status));

        pool.end();
    } catch (err) {
        console.error(err);
    }
}

analyze();
