
require('dotenv').config({ path: '../.env' });
const pool = require('../config/database');

async function check() {
    const res = await pool.query('SELECT DISTINCT status FROM properties');
    console.log('Status DB:', res.rows.map(r => r.status));
    const master = await pool.query('SELECT name FROM master_statuses');
    console.log('Master:', master.rows.map(r => r.name));
    pool.end();
}
check();
