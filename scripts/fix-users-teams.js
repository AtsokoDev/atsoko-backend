
require('dotenv').config({ path: '../.env' });
const pool = require('../config/database');

async function fixUsers() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const map = { 'A': 'Team A', 'B': 'Team B', 'C': 'Team C' };

        for (const [oldName, newName] of Object.entries(map)) {
            const res = await client.query(`UPDATE users SET team = $1 WHERE team = $2`, [newName, oldName]);
            if (res.rowCount > 0) console.log(`Updated ${res.rowCount} users: ${oldName} -> ${newName}`);
        }

        await client.query('COMMIT');
        console.log('User teams cleaned.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

fixUsers();
