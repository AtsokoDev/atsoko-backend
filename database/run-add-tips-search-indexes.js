/**
 * Add performance indexes for tips search API
 * Safe to run multiple times — all indexes use IF NOT EXISTS
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const SQL_FILE = path.join(__dirname, 'add-tips-search-indexes.sql');

async function run() {
    const client = await pool.connect();
    try {
        const sql = fs.readFileSync(SQL_FILE, 'utf8');
        console.log('Adding tips search indexes...');
        await client.query(sql);
        console.log('✅ Tips search indexes created (or already exist)');
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
