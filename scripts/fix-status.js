
require('dotenv').config({ path: '../.env' });
const pool = require('../config/database');

async function fixStatus() {
    try {
        await pool.query('BEGIN');
        const res = await pool.query(`
            UPDATE properties 
            SET status = 'For Rent & Sale' 
            WHERE status LIKE '%|%'
        `);
        console.log(`Updated ${res.rowCount} rows: '|' -> 'For Rent & Sale'`);

        // Sync IDs again
        await pool.query(`
            UPDATE properties p
            SET status_id = ms.id
            FROM master_statuses ms
            WHERE p.status = ms.name->>'en'
            AND (p.status_id IS NULL OR p.status_id != ms.id)
        `);

        await pool.query('COMMIT');
        console.log('Status fixed.');
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error(e);
    } finally {
        pool.end();
    }
}
fixStatus();
