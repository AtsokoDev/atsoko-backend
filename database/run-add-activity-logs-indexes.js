/**
 * Add performance indexes for activity-logs API
 * Safe to run multiple times — all indexes use IF NOT EXISTS
 */
require('dotenv').config();
const path = require('path');
const fs   = require('fs');
const pool = require('../config/database');

async function run() {
    const sql = fs.readFileSync(
        path.join(__dirname, 'add-activity-logs-indexes.sql'),
        'utf8'
    );

    const client = await pool.connect();
    try {
        console.log('Adding activity-logs indexes...');
        await client.query(sql);
        console.log('✅ Indexes created (or already exist)');
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
